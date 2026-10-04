// 存储抽象层：Cloudflare R2 binding（Workers）→ 外部图床 API → 本地磁盘
// - Cloudflare Workers：优先用 R2 binding（wrangler.jsonc 声明 FORUMLIFY_BUCKET），无需 S3 密钥
// - 其他平台：配置 IMGBED_API + IMGBED_AUTH 走外部图床 API；无配置则本地磁盘 uploads/
import { AwsClient } from 'aws4fetch';

// ===== 外部图床 API 配置（从环境变量读取）=====
const IMGBED_API = process.env.IMGBED_API;       // 例如 https://你的图床域名/upload
const IMGBED_AUTH = process.env.IMGBED_AUTH;     // 你的 authCode
const IMGBED_BASE = process.env.IMGBED_BASE || ''; // 图床返回的 URL 前缀（如果 API 返回相对路径）

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;

// 存储模式：r2-binding > external-api > s3 > local
export const STORAGE_TYPE = isR2BindingAvailable()
  ? 'r2'
  : (IMGBED_API && IMGBED_AUTH ? 'external' : (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY ? 's3' : 'local'));

const aws = STORAGE_TYPE === 's3'
  ? new AwsClient({ accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY, region: S3_REGION, service: 's3' })
  : null;

function isR2BindingAvailable() {
  try {
    const ctx = globalThis.__OPENNEXT_CLOUDFLARE__;
    return !!(ctx && ctx.env && ctx.env.FORUMLIFY_BUCKET);
  } catch {
    return false;
  }
}

async function getR2Bucket() {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const ctx = await getCloudflareContext({ async: true });
  return ctx.env.FORUMLIFY_BUCKET;
}

function objectUrl(name) {
  return `${S3_ENDPOINT}/${S3_BUCKET}/${name}`;
}

// ===== 外部图床 API 辅助函数 =====
// 调用图床 API 上传，返回 { url }
async function externalUpload(name, buffer, contentType) {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' });
  formData.append('file', blob, name);

  const res = await fetch(`${IMGBED_API}?authCode=${encodeURIComponent(IMGBED_AUTH)}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`图床上传失败 ${res.status}: ${errText}`);
  }

  const result = await res.json();
  // CloudFlare-ImgBed 返回格式：{ data: [{ src: "https://..." }] } 或直接数组
  const src = result?.data?.[0]?.src || result?.[0]?.src || result?.src;
  if (!src) throw new Error('图床未返回图片 URL: ' + JSON.stringify(result));

  // 如果返回的是相对路径，补上 base
  const url = src.startsWith('http') ? src : `${IMGBED_BASE}${src}`;
  return { url };
}

// 从图床 URL 反推文件名（用于 getObject / deleteObject）
function nameFromUrl(name) {
  // name 是 Forumlify 生成的 key，图床返回的 URL 里通常包含文件名
  // 这里直接用传入的 name 作为标识
  return name;
}

// 保存对象 → 返回公开 URL
export async function saveObject(name, buffer, contentType) {
  if (STORAGE_TYPE === 'r2') {
    const bucket = await getR2Bucket();
    await bucket.put(name, new Uint8Array(buffer), { httpMetadata: { contentType: contentType || 'application/octet-stream' } });
    return { url: publicUrl(name) };
  }

  if (STORAGE_TYPE === 'external') {
    return await externalUpload(name, buffer, contentType);
  }

  if (STORAGE_TYPE === 'local') {
    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
    return { url: '/uploads/' + name };
  }

  await aws.fetch(objectUrl(name), {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body: new Uint8Array(buffer),
  });
  return { url: publicUrl(name) };
}

function publicUrl(name) {
  if (S3_PUBLIC_URL) {
    const base = S3_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${name}`;
  }
  if (S3_ENDPOINT) {
    const base = S3_ENDPOINT.replace(/\/$/, '');
    return `${base}/${S3_BUCKET}/${name}`;
  }
  return '/uploads/' + name;
}

// 读取对象 → Buffer 或 null
// 注意：CloudFlare-ImgBed 的 API 没有提供"按 key 读取"的接口，
// 这里通过 IMGBED_BASE + name 直接 fetch 图片内容（前提是图片 URL 可公开访问）
export async function getObject(name) {
  if (STORAGE_TYPE === 'r2') {
    const bucket = await getR2Bucket();
    const obj = await bucket.get(name);
    if (!obj) return null;
    return Buffer.from(await obj.arrayBuffer());
  }

  if (STORAGE_TYPE === 'external') {
    // 如果 name 本身就是完整 URL，直接 fetch；否则拼上 IMGBED_BASE
    const url = name.startsWith('http') ? name : `${IMGBED_BASE}${name}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  if (STORAGE_TYPE === 'local') {
    const { readFile } = await import('fs/promises');
    const path = await import('path');
    try {
      return await readFile(path.join(process.cwd(), 'uploads', name));
    } catch {
      return null;
    }
  }

  const res = await aws.fetch(objectUrl(name));
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// 删除对象
// 注意：CloudFlare-ImgBed 的删除接口需要文件的存储路径和 sha，
// 仅凭 name 无法直接删除。这里对 external 模式做"尽力而为"处理：
// 如果 name 是完整 URL，尝试调用图床删除 API（需要你自己扩展）。
export async function deleteObject(name) {
  if (STORAGE_TYPE === 'r2') {
    const bucket = await getR2Bucket();
    await bucket.delete(name);
    return;
  }

  if (STORAGE_TYPE === 'external') {
    // CloudFlare-ImgBed 删除需要 path + sha，这里仅记录警告，不做实际删除
    console.warn(`[external] deleteObject 未实现，跳过删除: ${name}`);
    return;
  }

  if (STORAGE_TYPE === 'local') {
    const { unlink } = await import('fs/promises');
    const path = await import('path');
    try { await unlink(path.join(process.cwd(), 'uploads', name)); } catch { /* ignore */ }
    return;
  }

  await aws.fetch(objectUrl(name), { method: 'DELETE' });
}
