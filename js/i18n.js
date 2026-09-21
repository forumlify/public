// ============================================================
//  🌍 国际化外挂脚本（不修改任何源文件）
//  默认英文，支持 URL 参数 ?lang=zh / ?lang=en
// ============================================================

const TRANSLATIONS = {
  'zh': {
    // ===== 导航 =====
    '登录': '登录',
    '注册': '注册',
    '消息': '消息',
    '设置': '设置',
    '管理后台': '管理后台',
    '暗色模式': '暗色模式',
    '亮色模式': '亮色模式',
    '退出': '退出',
    '暂无链接': '暂无链接',
    '举报': '举报',
    '用户': '用户',
    '日志': '日志',
    '友链': '友链',
    '自定义 CSS': '自定义 CSS',
    '论坛设置': '论坛设置',
    '自定义页面': '自定义页面',
    '✉️ 私信': '✉️ 私信',

    // ===== 帖子 =====
    '最新发布': '最新发布',
    '最新回复': '最新回复',
    '发布新帖': '发布新帖',
    '标题': '标题',
    '说点什么...': '说点什么...',
    '发布帖子': '发布帖子',
    '加载中...': '加载中...',
    '还没有帖子，快来发布第一条吧！': '还没有帖子，快来发布第一条吧！',
    '暂无帖子': '暂无帖子',
    '删除': '删除',
    '编辑': '编辑',
    '置顶': '置顶',
    '取消置顶': '取消置顶',
    '已编辑': '已编辑',
    '匿名': '匿名',
    '无标题': '无标题',
    '回复': '回复',
    '📌 置顶': '📌 置顶',
    '✏️ 编辑': '✏️ 编辑',

    // ===== 帖子详情 =====
    '帖子详情': '帖子详情',
    '发表回复': '发表回复',
    '提交回复': '提交回复',
    '还没有回复，快来抢沙发吧 🛋️': '还没有回复，快来抢沙发吧 🛋️',
    '写下你的回复...': '写下你的回复...',
    '条回复': '条回复',

    // ===== 统计 =====
    '社区统计': '社区统计',
    '主题': '主题',
    '帖子': '帖子',
    '用户': '用户',
    '友情链接': '友情链接',

    // ===== 登录/注册 =====
    '邮箱': '邮箱',
    '密码': '密码',
    '忘记密码？': '忘记密码？',
    '用户名': '用户名',
    '密码（至少6位）': '密码（至少6位）',
    '请先登录': '请先登录',

    // ===== 管理后台 =====
    '举报记录': '举报记录',
    '用户列表': '用户列表',
    '操作日志': '操作日志',
    '自定义CSS': '自定义CSS',
    '论坛名称设置': '论坛名称设置',
    '暂无举报': '暂无举报',
    '待处理': '待处理',
    '已删除': '已删除',
    '已驳回': '已驳回',
    '角色': '角色',
    '注册时间': '注册时间',

    // ===== 设置页面 =====
    '个人资料': '个人资料',
    '安全设置': '安全设置',
    '恢复码': '恢复码',
    '保存设置': '保存设置',
    '修改密码': '修改密码',
    '当前密码': '当前密码',
    '新密码': '新密码',
    '修改邮箱': '修改邮箱',
    '新邮箱': '新邮箱',
    '查看恢复码': '查看恢复码',
    '重新生成': '重新生成',
    '个人简介': '个人简介',
    '帖子签名': '帖子签名',
    '显示在每篇帖子底部，支持 Markdown': '显示在每篇帖子底部，支持 Markdown',
    '用 --- 分隔，支持 Markdown': '用 --- 分隔，支持 Markdown',
    '当前密码（验证身份）': '当前密码（验证身份）',

    // ===== 恢复码 =====
    '用于忘记密码时重置账户。每个恢复码只能使用一次。': '用于忘记密码时重置账户。每个恢复码只能使用一次。',
    '请妥善保存以下恢复码。当你忘记密码时，可以使用它们重置密码。': '请妥善保存以下恢复码。当你忘记密码时，可以使用它们重置密码。',
    '每个恢复码只能使用一次。': '每个恢复码只能使用一次。',
    '剩余 0 个可用恢复码': '剩余 0 个可用恢复码',
    '剩余 1 个可用恢复码': '剩余 1 个可用恢复码',
    '剩余 2 个可用恢复码': '剩余 2 个可用恢复码',
    '剩余 3 个可用恢复码': '剩余 3 个可用恢复码',
    '剩余 4 个可用恢复码': '剩余 4 个可用恢复码',
    '剩余 5 个可用恢复码': '剩余 5 个可用恢复码',
    '剩余 6 个可用恢复码': '剩余 6 个可用恢复码',
    '剩余 7 个可用恢复码': '剩余 7 个可用恢复码',
    '剩余 8 个可用恢复码': '剩余 8 个可用恢复码',
    '剩余 9 个可用恢复码': '剩余 9 个可用恢复码',
    '剩余 10 个可用恢复码': '剩余 10 个可用恢复码',
    '复制全部': '复制全部',
    '我已保存': '我已保存',

    // ===== 自定义页面 =====
    '添加页面': '添加页面',
    '页面名称': '页面名称',
    '导航栏显示名称': '导航栏显示名称',
    '关于我们': '关于我们',
    '状态': '状态',
    '启用': '启用',
    '禁用': '禁用',
    '页面内容': '页面内容',
    '保存': '保存',
    '编辑页面': '编辑页面',
    '只允许字母、数字、短横线和下划线': '只允许字母、数字、短横线和下划线',
    '用于 URL: ?custom=': '用于 URL: ?custom=',
    '页面内容（HTML + CSS + JS）': '页面内容（HTML + CSS + JS）',
    '支持 HTML、CSS（<style>）、JS（<script>），内容会在独立的沙盒中渲染': '支持 HTML、CSS（<style>）、JS（<script>），内容会在独立的沙盒中渲染',
    '暂无自定义页面': '暂无自定义页面',

    // ===== 自定义 CSS =====
    '自定义 CSS': '自定义 CSS',
    '上传 style.css 覆盖默认样式，自定义论坛外观。': '上传 style.css 覆盖默认样式，自定义论坛外观。',
    '点击或拖拽上传 style.css': '点击或拖拽上传 style.css',
    '只能上传 style.css 文件': '只能上传 style.css 文件',
    '保存 CSS': '保存 CSS',
    '删除自定义 CSS': '删除自定义 CSS',

    // ===== 自定义 CSS 警告模态框 =====
    '警告': '警告',
    '若上传的 style.css 存在问题，将导致整个论坛界面样式错乱，甚至无法正常使用。': '若上传的 style.css 存在问题，将导致整个论坛界面样式错乱，甚至无法正常使用。',
    '请确保 CSS 文件是完整的、经过测试的版本。如出现问题，可点击「删除自定义 CSS」恢复默认样式。': '请确保 CSS 文件是完整的、经过测试的版本。如出现问题，可点击「删除自定义 CSS」恢复默认样式。',
    '我了解，继续上传': '我了解，继续上传',
    '取消': '取消',

    // ===== 友情链接 =====
    '链接名称': '链接名称',
    '链接地址': '链接地址',
    '添加': '添加',

    // ===== 通知 =====
    '有人回复了你的帖子': '有人回复了你的帖子',
    '查看详情 →': '查看详情 →',
    '你的帖子已被删除': '你的帖子已被删除',
    '你的举报已被处理': '你的举报已被处理',
    '你的帖子已被置顶': '你的帖子已被置顶',
    '管理员取消了你的帖子置顶': '管理员取消了你的帖子置顶',
    '管理员删除了你的帖子': '管理员删除了你的帖子',
    '你举报的帖子已被管理员删除': '你举报的帖子已被管理员删除',
    '你举报的帖子已被管理员驳回': '你举报的帖子已被管理员驳回',
    '管理员把你的帖子置顶了': '管理员把你的帖子置顶了',

    // ===== Toast =====
    '已复制到剪贴板': '已复制到剪贴板',

    // ===== 发帖/上传 =====
    '点击或拖拽上传图片': '点击或拖拽上传图片',
    '支持 JPG、PNG、GIF、WebP，单张最大 5MB': '支持 JPG、PNG、GIF、WebP，单张最大 5MB',

    // ===== 提示 =====
    '保存成功！': '保存成功！',
    '保存失败': '保存失败',
    '操作失败': '操作失败',
    '删除成功': '删除成功',
    '删除失败': '删除失败',
    '确定删除吗？': '确定删除吗？',
    '确定要删除该帖子吗？': '确定要删除该帖子吗？',
    '举报已提交': '举报已提交',
    '修改成功': '修改成功',
    '加载失败': '加载失败',
    '加载失败：': '加载失败：',
    '请填写完整信息': '请填写完整信息',
    '请输入页面名称': '请输入页面名称',
    '请输入导航栏显示名称': '请输入导航栏显示名称',
    '请输入页面内容': '请输入页面内容',

    // ===== 举报 =====
    '举报了帖子': '举报了帖子',
    '原因：': '原因：',
    '帖子：': '帖子：',
    '状态：': '状态：',
    '处理人：': '处理人：',
    '删除帖子': '删除帖子',
    '驳回举报': '驳回举报',

    // ===== 用户 =====
    '共': '共',
    '位用户': '位用户',
    '搜索用户名...': '搜索用户名...',
    '搜索': '搜索',
    '清空': '清空',
    '管理员': '管理员',
    '普通用户': '普通用户',
    '不可操作自己': '不可操作自己',
    '设为普通用户': '设为普通用户',
    '设为管理员': '设为管理员',

    // ===== 日志 =====
    '暂无日志': '暂无日志',
    '时间': '时间',
    '操作': '操作',
    '条日志': '条日志',

    // ===== 重置密码 =====
    '重置密码': '重置密码',
    '输入你的邮箱和一个未使用的恢复码': '输入你的邮箱和一个未使用的恢复码',
    '恢复码（格式：ABCD-1234-EFGH-5678）': '恢复码（格式：ABCD-1234-EFGH-5678）',
    '新密码（至少6位）': '新密码（至少6位）',

    // ===== 用户主页 =====
    '用户主页': '用户主页',
    '用户不存在': '用户不存在',
    '这个人很懒，什么都没写': '这个人很懒，什么都没写',
    '加入': '加入',
    '于': '于',
    '发了': '发了',
    '个帖子': '个帖子',
    '帖': '帖',
    '发私信': '发私信',
    '还没有发帖': '还没有发帖',
    '加入 ': '加入 ',

    // ===== 私信 =====
    '私信': '私信',
    '暂无私信': '暂无私信',
    '还没有消息，打个招呼吧': '还没有消息，打个招呼吧',
    '输入消息...': '输入消息...',
    '发送': '发送',

    // ===== Toast 通用 =====
    '请选择图片文件': '请选择图片文件',
    '图片不能超过 5MB': '图片不能超过 5MB',
    '上传中...': '上传中...',
    '头像更新成功！': '头像更新成功！',
    '文件名必须是 style.css': '文件名必须是 style.css',
    '请上传 CSS 文件': '请上传 CSS 文件',
    '已选择: ': '已选择: ',
    '请先选择 style.css 文件': '请先选择 style.css 文件',
    'CSS 上传成功！刷新页面查看效果': 'CSS 上传成功！刷新页面查看效果',
    '上传失败': '上传失败',
    '已删除自定义 CSS': '已删除自定义 CSS',
    '删除失败': '删除失败',
    '密码修改成功！': '密码修改成功！',
    '邮箱修改成功！': '邮箱修改成功！',
    '重置成功！请登录': '重置成功！请登录',

    // ===== 其他 =====
    '返回': '返回',
    '答案': '答案',
    '请填写内容': '请填写内容',
    '发布成功！': '发布成功！',
    '发布失败': '发布失败',

    // ===== 举报原因 =====
    '垃圾广告': '垃圾广告',
    '人身攻击': '人身攻击',
    '违法内容': '违法内容',
    '不适当内容': '不适当内容',
    '其他': '其他',
    '请选择举报原因：': '请选择举报原因：',
    '提交举报': '提交举报',

    // ===== 论坛名称 =====
    '论坛名称': '论坛名称',

    // ===== 补充覆盖：操作状态与错误提示 =====
    // 源码里这些提示多带「：」后缀拼接具体原因，与上方不带冒号的
    // 短词是不同字符串，必须分别登记才能命中。
    '保存失败：': '保存失败：',
    '编辑成功！': '编辑成功！',
    '编辑失败：': '编辑失败：',
    '操作失败：': '操作失败：',
    '打开私信失败：': '打开私信失败：',
    '登录失败：': '登录失败：',
    '发布失败：': '发布失败：',
    '发送失败：': '发送失败：',
    '恢复码生成失败:': '恢复码生成失败:',
    '回复失败：': '回复失败：',
    '获取恢复码失败：': '获取恢复码失败：',
    '举报失败：': '举报失败：',
    '删除失败：': '删除失败：',
    '上传失败：': '上传失败：',
    '添加失败：': '添加失败：',
    '重新生成失败：': '重新生成失败：',
    '注册失败：': '注册失败：',
    '页面加载失败：': '页面加载失败：',
    '加载失败：': '加载失败：',

    // ===== 补充覆盖：表单校验与按钮 =====
    '保存修改': '保存修改',
    '密码至少6位': '密码至少6位',
    '新密码至少6位': '新密码至少6位',
    '验证码错误，请重新计算': '验证码错误，请重新计算',
    '用户名不能为空': '用户名不能为空',
    '请输入论坛名称': '请输入论坛名称',
    '请填写回复内容': '请填写回复内容',
    '页面名称只允许字母、数字、短横线和下划线': '页面名称只允许字母、数字、短横线和下划线',
    '移除': '移除',
    '名称': '名称',
    '图片': '图片',
    '未知': '未知',
    '系统': '系统',
    '无权限访问': '无权限访问',
    '匿名用户': '匿名用户',
    '发布中...': '发布中...',
    '上传图片中...': '上传图片中...',
    '松开上传': '松开上传',
    '每篇帖子最多上传 6 张图片': '每篇帖子最多上传 6 张图片',
    '上传响应无效': '上传响应无效',
    '图片上传失败': '图片上传失败',
    '已选择:': '已选择:',
    '举报不成立': '举报不成立',
    '已删除违规帖子': '已删除违规帖子',
    '暂无用户': '暂无用户',
    '暂无友情链接': '暂无友情链接',
    '暂无消息': '暂无消息',

    // ===== 补充覆盖：确认对话框 =====
    '确定要': '确定要',
    '置顶吗？': '置顶吗？',
    '确定要退出吗？': '确定要退出吗？',
    '确定删除该链接吗？': '确定删除该链接吗？',
    '确定要删除这条回复吗？': '确定要删除这条回复吗？',
    '确定要删除这条帖子吗？': '确定要删除这条帖子吗？',
    '确定要删除这个页面吗？': '确定要删除这个页面吗？',
    '确定要删除该帖子并标记举报为已处理吗？': '确定要删除该帖子并标记举报为已处理吗？',
    '确定要删除自定义 CSS 吗？将恢复默认样式。': '确定要删除自定义 CSS 吗？将恢复默认样式。',
    '重新生成将替换所有旧的恢复码，确定继续吗？': '重新生成将替换所有旧的恢复码，确定继续吗？',

    // ===== 补充覆盖：混合文案 =====
    '当有人回复你的帖子或处理你的举报时，会在这里通知你': '当有人回复你的帖子或处理你的举报时，会在这里通知你',
    '举报已提交，管理员将尽快处理': '举报已提交，管理员将尽快处理',
    '注册成功，但自动登录失败，请手动登录：': '注册成功，但自动登录失败，请手动登录：',
    '注册并登录成功，但恢复码生成失败。请稍后在设置中重新生成。': '注册并登录成功，但恢复码生成失败。请稍后在设置中重新生成。',
    '支持 HTML、CSS（&lt;style&gt;）、JS（&lt;script&gt;），内容会在独立的沙盒中渲染': '支持 HTML、CSS（&lt;style&gt;）、JS（&lt;script&gt;），内容会在独立的沙盒中渲染',

    // ===== 动态文本前缀 =====
    // 「剩余 N 个可用恢复码」由模板字符串生成，整串无法匹配，
    // 因此登记可命中的固定片段。
    '剩余': '剩余',
    '个可用恢复码': '个可用恢复码',
    '原因：': '原因：',
    '状态：': '状态：',
    '处理人：': '处理人：',
    '帖子：': '帖子：',
  },

  'en': {
    // ===== 导航 =====
    '登录': 'Login',
    '注册': 'Register',
    '消息': 'Messages',
    '设置': 'Settings',
    '管理后台': 'Admin',
    '暗色模式': 'Dark Mode',
    '亮色模式': 'Light Mode',
    '退出': 'Logout',
    '暂无链接': 'No links',
    '举报': 'Reports',
    '用户': 'Users',
    '日志': 'Logs',
    '友链': 'Links',
    '自定义 CSS': 'Custom CSS',
    '论坛设置': 'Forum Settings',
    '自定义页面': 'Custom Pages',
    '✉️ 私信': '✉️ Messages',

    // ===== 帖子 =====
    '最新发布': 'Latest',
    '最新回复': 'Recent',
    '发布新帖': 'New Post',
    '标题': 'Title',
    '说点什么...': 'Say something...',
    '发布帖子': 'Publish',
    '加载中...': 'Loading...',
    '还没有帖子，快来发布第一条吧！': 'No posts yet. Be the first!',
    '暂无帖子': 'No posts',
    '删除': 'Delete',
    '编辑': 'Edit',
    '置顶': 'Pin',
    '取消置顶': 'Unpin',
    '已编辑': 'Edited',
    '匿名': 'Anonymous',
    '无标题': 'Untitled',
    '回复': 'Reply',
    '📌 置顶': '📌 Pinned',
    '✏️ 编辑': '✏️ Edit',

    // ===== 帖子详情 =====
    '帖子详情': 'Post Details',
    '发表回复': 'Reply',
    '提交回复': 'Submit Reply',
    '还没有回复，快来抢沙发吧 🛋️': 'No replies yet. Be the first!',
    '写下你的回复...': 'Write your reply...',
    '条回复': ' replies',

    // ===== 统计 =====
    '社区统计': 'Community Stats',
    '主题': 'Topics',
    '帖子': 'Posts',
    '用户': 'Users',
    '友情链接': 'Links',

    // ===== 登录/注册 =====
    '邮箱': 'Email',
    '密码': 'Password',
    '忘记密码？': 'Forgot Password?',
    '用户名': 'Username',
    '密码（至少6位）': 'Password (min 6 chars)',
    '请先登录': 'Please login first',

    // ===== 管理后台 =====
    '举报记录': 'Reports',
    '用户列表': 'Users',
    '操作日志': 'Logs',
    '自定义CSS': 'Custom CSS',
    '论坛名称设置': 'Forum Settings',
    '暂无举报': 'No reports',
    '待处理': 'Pending',
    '已删除': 'Approved',
    '已驳回': 'Rejected',
    '角色': 'Role',
    '注册时间': 'Registered',

    // ===== 设置页面 =====
    '个人资料': 'Profile',
    '安全设置': 'Security',
    '恢复码': 'Recovery Codes',
    '保存设置': 'Save Settings',
    '修改密码': 'Change Password',
    '当前密码': 'Current Password',
    '新密码': 'New Password',
    '修改邮箱': 'Change Email',
    '新邮箱': 'New Email',
    '查看恢复码': 'View Recovery Codes',
    '重新生成': 'Regenerate',
    '个人简介': 'Bio',
    '帖子签名': 'Post Signature',
    '显示在每篇帖子底部，支持 Markdown': 'Displayed at the bottom of each post. Supports Markdown.',
    '用 --- 分隔，支持 Markdown': 'Use --- as separator. Supports Markdown.',
    '当前密码（验证身份）': 'Current password (verify identity)',

    // ===== 恢复码 =====
    '用于忘记密码时重置账户。每个恢复码只能使用一次。': 'Used to reset your password if you forget it. Each recovery code can only be used once.',
    '请妥善保存以下恢复码。当你忘记密码时，可以使用它们重置密码。': 'Please save these recovery codes. You can use them to reset your password if you forget it.',
    '每个恢复码只能使用一次。': 'Each recovery code can only be used once.',
    '剩余 0 个可用恢复码': '0 recovery codes available',
    '剩余 1 个可用恢复码': '1 recovery code available',
    '剩余 2 个可用恢复码': '2 recovery codes available',
    '剩余 3 个可用恢复码': '3 recovery codes available',
    '剩余 4 个可用恢复码': '4 recovery codes available',
    '剩余 5 个可用恢复码': '5 recovery codes available',
    '剩余 6 个可用恢复码': '6 recovery codes available',
    '剩余 7 个可用恢复码': '7 recovery codes available',
    '剩余 8 个可用恢复码': '8 recovery codes available',
    '剩余 9 个可用恢复码': '9 recovery codes available',
    '剩余 10 个可用恢复码': '10 recovery codes available',
    '复制全部': 'Copy All',
    '我已保存': 'Saved',

    // ===== 自定义页面 =====
    '添加页面': 'Add Page',
    '页面名称': 'Page Name',
    '导航栏显示名称': 'Display Name',
    '关于我们': 'About Us',
    '状态': 'Status',
    '启用': 'Enabled',
    '禁用': 'Disabled',
    '页面内容': 'Page Content',
    '保存': 'Save',
    '编辑页面': 'Edit Page',
    '只允许字母、数字、短横线和下划线': 'Only letters, numbers, hyphens and underscores allowed',
    '用于 URL: ?custom=': 'Used in URL: ?custom=',
    '页面内容（HTML + CSS + JS）': 'Page Content (HTML + CSS + JS)',
    '支持 HTML、CSS（<style>）、JS（<script>），内容会在独立的沙盒中渲染': 'Supports HTML, CSS (<style>), JS (<script>). Rendered in an isolated sandbox.',
    '暂无自定义页面': 'No custom pages',

    // ===== 自定义 CSS =====
    '自定义 CSS': 'Custom CSS',
    '上传 style.css 覆盖默认样式，自定义论坛外观。': 'Upload style.css to override default styles and customize the forum appearance.',
    '点击或拖拽上传 style.css': 'Click or drag to upload style.css',
    '只能上传 style.css 文件': 'Only style.css files are allowed',
    '保存 CSS': 'Save CSS',
    '删除自定义 CSS': 'Delete Custom CSS',

    // ===== 自定义 CSS 警告模态框 =====
    '警告': 'Warning',
    '若上传的 style.css 存在问题，将导致整个论坛界面样式错乱，甚至无法正常使用。': 'If the uploaded style.css has issues, it may break the entire forum layout.',
    '请确保 CSS 文件是完整的、经过测试的版本。如出现问题，可点击「删除自定义 CSS」恢复默认样式。': 'Please ensure the CSS file is complete and tested. If problems occur, click "Delete Custom CSS" to restore default styles.',
    '我了解，继续上传': 'I understand, continue upload',
    '取消': 'Cancel',

    // ===== 友情链接 =====
    '链接名称': 'Link Name',
    '链接地址': 'Link URL',
    '添加': 'Add',

    // ===== 通知 =====
    '有人回复了你的帖子': 'Someone replied to your post',
    '查看详情 →': 'View details →',
    '你的帖子已被删除': 'Your post has been deleted',
    '你的举报已被处理': 'Your report has been processed',
    '你的帖子已被置顶': 'Your post has been pinned',
    '管理员取消了你的帖子置顶': 'An admin has unpinned your post',
    '管理员删除了你的帖子': 'An admin deleted your post',
    '你举报的帖子已被管理员删除': 'The post you reported has been deleted',
    '你举报的帖子已被管理员驳回': 'The post you reported has been rejected',
    '管理员把你的帖子置顶了': 'An admin pinned your post',

    // ===== Toast =====
    '已复制到剪贴板': 'Copied to clipboard',

    // ===== 发帖/上传 =====
    '点击或拖拽上传图片': 'Click or drag to upload image',
    '支持 JPG、PNG、GIF、WebP，单张最大 5MB': 'Supports JPG, PNG, GIF, WebP, max 5MB',

    // ===== 提示 =====
    '保存成功！': 'Saved!',
    '保存失败': 'Save failed',
    '操作失败': 'Operation failed',
    '删除成功': 'Deleted',
    '删除失败': 'Delete failed',
    '确定删除吗？': 'Are you sure?',
    '确定要删除该帖子吗？': 'Delete this post?',
    '举报已提交': 'Report submitted',
    '修改成功': 'Updated',
    '加载失败': 'Load failed',
    '加载失败：': 'Load failed: ',
    '请填写完整信息': 'Please fill in all fields',
    '请输入页面名称': 'Please enter a page name',
    '请输入导航栏显示名称': 'Please enter a display name',
    '请输入页面内容': 'Please enter page content',

    // ===== 举报 =====
    '举报了帖子': 'reported a post',
    '原因：': 'Reason: ',
    '帖子：': 'Post: ',
    '状态：': 'Status: ',
    '处理人：': 'Handler: ',
    '删除帖子': 'Delete Post',
    '驳回举报': 'Reject',

    // ===== 用户 =====
    '共': 'Total',
    '位用户': ' users',
    '搜索用户名...': 'Search username...',
    '搜索': 'Search',
    '清空': 'Clear',
    '管理员': 'Admin',
    '普通用户': 'User',
    '不可操作自己': 'Cannot modify yourself',
    '设为普通用户': 'Set as User',
    '设为管理员': 'Set as Admin',

    // ===== 日志 =====
    '暂无日志': 'No logs',
    '时间': 'Time',
    '操作': 'Action',
    '条日志': ' logs',

    // ===== 重置密码 =====
    '重置密码': 'Reset Password',
    '输入你的邮箱和一个未使用的恢复码': 'Enter your email and an unused recovery code',
    '恢复码（格式：ABCD-1234-EFGH-5678）': 'Recovery code (format: ABCD-1234-EFGH-5678)',
    '新密码（至少6位）': 'New password (min 6 chars)',

    // ===== 用户主页 =====
    '用户主页': 'User Profile',
    '用户不存在': 'User not found',
    '这个人很懒，什么都没写': 'This user is lazy, nothing written',
    '加入': 'Joined',
    // 「于」在中文句式里连接日期（加入于 2024-01-01），英文不需要对应词。
    // 这里保留原词而非空串：walk() 命中后用译文整体替换原文，空串会把
    // 文字抹掉；同时该键实际不会被单独命中（源码中是「加入于」整串）。
    '于': '于',
    '发了': 'Posted',
    '个帖子': ' posts',
    '帖': ' posts',
    '发私信': 'Send Message',
    '还没有发帖': 'No posts yet',
    '加入 ': 'Joined ',

    // ===== 私信 =====
    '私信': 'Messages',
    '暂无私信': 'No messages',
    '还没有消息，打个招呼吧': 'No messages yet. Say hi!',
    '输入消息...': 'Type a message...',
    '发送': 'Send',

    // ===== Toast 通用 =====
    '请选择图片文件': 'Please select an image',
    '图片不能超过 5MB': 'Image must be under 5MB',
    '上传中...': 'Uploading...',
    '头像更新成功！': 'Avatar updated!',
    '文件名必须是 style.css': 'File name must be style.css',
    '请上传 CSS 文件': 'Please upload a CSS file',
    '已选择: ': 'Selected: ',
    '请先选择 style.css 文件': 'Please select style.css first',
    'CSS 上传成功！刷新页面查看效果': 'CSS uploaded! Refresh to see changes',
    '上传失败': 'Upload failed',
    '已删除自定义 CSS': 'Custom CSS deleted',
    '删除失败': 'Delete failed',
    '密码修改成功！': 'Password updated!',
    '邮箱修改成功！': 'Email updated!',
    '重置成功！请登录': 'Reset successful! Please login',

    // ===== 其他 =====
    '返回': 'Back',
    '答案': 'Answer',
    '请填写内容': 'Please enter content',
    '发布成功！': 'Posted!',
    '发布失败': 'Post failed',

    // ===== 举报原因 =====
    '垃圾广告': 'Spam',
    '人身攻击': 'Abuse',
    '违法内容': 'Illegal',
    '不适当内容': 'NSFW',
    '其他': 'Other',
    '请选择举报原因：': 'Select a reason:',
    '提交举报': 'Submit Report',

    // ===== 论坛名称 =====
    '论坛名称': 'Forum Name',

    // ===== 补充覆盖：操作状态与错误提示 =====
    '保存失败：': 'Save failed: ',
    '编辑成功！': 'Edited successfully!',
    '编辑失败：': 'Edit failed: ',
    '操作失败：': 'Operation failed: ',
    '打开私信失败：': 'Failed to open messages: ',
    '登录失败：': 'Login failed: ',
    '发布失败：': 'Publish failed: ',
    '发送失败：': 'Send failed: ',
    '恢复码生成失败:': 'Failed to generate recovery codes: ',
    '回复失败：': 'Reply failed: ',
    '获取恢复码失败：': 'Failed to load recovery codes: ',
    '举报失败：': 'Report failed: ',
    '删除失败：': 'Delete failed: ',
    '上传失败：': 'Upload failed: ',
    '添加失败：': 'Add failed: ',
    '重新生成失败：': 'Regeneration failed: ',
    '注册失败：': 'Registration failed: ',
    '页面加载失败：': 'Failed to load page: ',
    '加载失败：': 'Failed to load: ',

    // ===== 补充覆盖：表单校验与按钮 =====
    '保存修改': 'Save Changes',
    '密码至少6位': 'Password must be at least 6 characters',
    '新密码至少6位': 'New password must be at least 6 characters',
    '验证码错误，请重新计算': 'Incorrect captcha, please try again',
    '用户名不能为空': 'Username cannot be empty',
    '请输入论坛名称': 'Please enter a forum name',
    '请填写回复内容': 'Please enter your reply',
    '页面名称只允许字母、数字、短横线和下划线': 'Page name may only contain letters, numbers, hyphens and underscores',
    '移除': 'Remove',
    '名称': 'Name',
    '图片': 'Image',
    '未知': 'Unknown',
    '系统': 'System',
    '无权限访问': 'Access denied',
    '匿名用户': 'Anonymous',
    '发布中...': 'Publishing...',
    '上传图片中...': 'Uploading image...',
    '松开上传': 'Release to upload',
    '每篇帖子最多上传 6 张图片': 'Up to 6 images per post',
    '上传响应无效': 'Invalid upload response',
    '图片上传失败': 'Image upload failed',
    '已选择:': 'Selected:',
    '举报不成立': 'Report dismissed',
    '已删除违规帖子': 'Removed the violating post',
    '暂无用户': 'No users',
    '暂无友情链接': 'No links',
    '暂无消息': 'No messages',

    // ===== 补充覆盖：确认对话框 =====
    '确定要': 'Are you sure you want to ',
    '置顶吗？': '?',
    '确定要退出吗？': 'Are you sure you want to log out?',
    '确定删除该链接吗？': 'Delete this link?',
    '确定要删除这条回复吗？': 'Delete this reply?',
    '确定要删除这条帖子吗？': 'Delete this post?',
    '确定要删除这个页面吗？': 'Delete this page?',
    '确定要删除该帖子并标记举报为已处理吗？': 'Delete this post and mark the report as handled?',
    '确定要删除自定义 CSS 吗？将恢复默认样式。': 'Delete the custom CSS? The default styles will be restored.',
    '重新生成将替换所有旧的恢复码，确定继续吗？': 'Regenerating will replace all existing recovery codes. Continue?',

    // ===== 补充覆盖：混合文案 =====
    '当有人回复你的帖子或处理你的举报时，会在这里通知你': 'You will be notified here when someone replies to your post or your report is handled',
    '举报已提交，管理员将尽快处理': 'Report submitted. An administrator will review it shortly',
    '注册成功，但自动登录失败，请手动登录：': 'Registration succeeded, but automatic login failed. Please log in manually: ',
    '注册并登录成功，但恢复码生成失败。请稍后在设置中重新生成。': 'Registered and signed in, but recovery codes could not be generated. Please regenerate them later in Settings.',
    '支持 HTML、CSS（&lt;style&gt;）、JS（&lt;script&gt;），内容会在独立的沙盒中渲染': 'Supports HTML, CSS (&lt;style&gt;) and JS (&lt;script&gt;). Content renders in an isolated sandbox',

    // ===== 动态文本前缀 =====
    // 「剩余 N 个可用恢复码」由模板字符串生成，整串无法命中词典，
    // 因此登记可命中的固定片段。注意这里不能译成空串：万一该词以
    // 独立文本节点出现，空串会把文字抹掉。
    '剩余': 'Remaining:',
    '个可用恢复码': 'recovery codes remaining',
    '原因：': 'Reason: ',
    '状态：': 'Status: ',
    '处理人：': 'Handled by: ',
    '帖子：': 'Post: ',
  }
};

// ============================================================
//  核心逻辑
// ============================================================

function detectLanguage() {
  // URL 参数优先
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam && TRANSLATIONS[langParam]) return langParam;

  const stored = localStorage.getItem('forumlify-lang');
  if (stored && TRANSLATIONS[stored]) return stored;

  const browserLang = navigator.language.slice(0, 2);
  if (TRANSLATIONS[browserLang]) return browserLang;

  return 'en';
}

let currentLang = detectLanguage();

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('forumlify-lang', lang);
  applyTranslation();
}

function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['zh'];
  return dict[key] || key;
}

function applyTranslation() {
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const trimmed = text.trim();
      if (trimmed && TRANSLATIONS['zh'][trimmed]) {
        const translated = t(trimmed);
        if (translated !== trimmed) {
          node.textContent = text.replace(trimmed, translated);
        }
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (['IFRAME', 'SCRIPT', 'STYLE'].includes(node.tagName)) return;

      if (node.placeholder && TRANSLATIONS['zh'][node.placeholder]) {
        node.placeholder = t(node.placeholder);
      }

      if (node.tagName === 'INPUT' && node.value && TRANSLATIONS['zh'][node.value]) {
        if (node.type !== 'password') {
          node.value = t(node.value);
        }
      }

      for (const child of node.childNodes) {
        walk(child);
      }
    }
  }

  walk(document.body);

  // 监听动态内容
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          walk(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
//  初始化
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  document.body.style.opacity = '0';
  setTimeout(function() {
    if (typeof loadForumName === 'function') {
      loadForumName();
    }
    applyTranslation();
    document.body.style.transition = 'opacity 0.2s ease';
    document.body.style.opacity = '1';
  }, 200);
});
