<template>
    <el-dialog :model-value="modelValue" :title="mode === 'edit' ? '编辑用户' : '新增用户'" width="480px"
        :close-on-click-modal="false" @close="handleClose">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" label-position="right">
            <el-form-item label="用户名">
                <el-input v-if="mode === 'edit'" :model-value="form.username" disabled placeholder="创建后不可修改" />
                <el-input v-else v-model="form.username" placeholder="小写字母、数字、连字符" />
                <div v-if="mode === 'create'" class="form-hint">创建后不可修改，用于登录</div>
            </el-form-item>

            <!-- ★ P0 规格 5.1：displayName -->
            <el-form-item label="姓名" prop="displayName">
                <el-input v-model="form.displayName" placeholder="显示名称（1~50 字），列表与告警认领处展示" />
            </el-form-item>

            <el-form-item label="密码" :prop="mode === 'create' ? 'password' : undefined">
                <el-input v-model="form.password" type="password" show-password
                    :placeholder="mode === 'edit' ? '留空则不修改' : '至少 6 位'" />
                <div v-if="mode === 'edit'" class="form-hint">留空表示保持原密码不变（重置密码：联系管理员走账号安全流程）</div>
            </el-form-item>

            <el-form-item label="角色" prop="role">
                <el-select v-model="form.role" style="width: 100%">
                    <el-option label="管理员（ADMIN）—— 全部权限" value="ADMIN" />
                    <el-option label="操作员（OPERATOR）—— 可注册/编辑服务" value="OPERATOR" />
                    <el-option label="查看者（VIEWER）—— 只读" value="VIEWER" />
                </el-select>
            </el-form-item>

            <el-form-item label="状态">
                <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
                <el-input v-model="form.phone" placeholder="可选" />
                <div v-if="mode === 'edit'" class="form-hint">留空表示清除手机号</div>
            </el-form-item>

            <el-form-item label="邮箱" prop="email">
                <el-input v-model="form.email" placeholder="可选" />
                <div v-if="mode === 'edit'" class="form-hint">留空表示清除邮箱</div>
            </el-form-item>
        </el-form>

        <template #footer>
            <el-button @click="handleClose">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="handleSubmit">
                {{ mode === 'edit' ? '保存' : '创建' }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    mode: { type: String, default: 'create' }, // create | edit
    user: { type: Object, default: null }      // 编辑时传入
})

const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
    username: '',
    displayName: '',
    password: '',
    role: 'OPERATOR',
    enabled: true,
    phone: '',
    email: ''
})

// 打开时按模式初始化
watch(
    () => props.modelValue,
    (val) => {
        if (!val) return
        if (props.mode === 'edit' && props.user) {
            Object.assign(form, {
                username: props.user.username || '',
                displayName: props.user.displayName || '',
                password: '',
                role: props.user.role || 'OPERATOR',
                enabled: props.user.enabled !== false,
                phone: props.user.phone || '',
                email: props.user.email || ''
            })
        } else {
            Object.assign(form, {
                username: '',
                displayName: '',
                password: '',
                role: 'OPERATOR',
                enabled: true,
                phone: '',
                email: ''
            })
        }
    }
)

const rules = {
    displayName: [
        { required: true, message: '请输入姓名（显示名称）', trigger: 'blur' },
        { min: 1, max: 50, message: '姓名长度 1~50 字', trigger: 'blur' }
    ],
    password: [
        { min: 6, message: '密码至少 6 位', trigger: 'blur' }
    ],
    role: [{ required: true, message: '请选择角色', trigger: 'change' }],
    phone: [
        { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
    ],
    email: [
        { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
    ]
}

async function handleSubmit() {
    if (!formRef.value) return

    try {
        await formRef.value.validate()
    } catch {
        return
    }

    if (props.mode === 'create' && !form.username) {
        ElMessage.warning('请输入用户名')
        return
    }

    submitting.value = true
    try {
        emit('success', { ...form, mode: props.mode })
        handleClose()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    } finally {
        submitting.value = false
    }
}

function handleClose() {
    emit('update:modelValue', false)
    if (formRef.value) {
        formRef.value.clearValidate()
        formRef.value.resetFields()
    }
    Object.assign(form, {
        username: '',
        displayName: '',
        password: '',
        role: 'OPERATOR',
        enabled: true,
        phone: '',
        email: ''
    })
}
</script>

<style scoped>
.form-hint {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
}
</style>
