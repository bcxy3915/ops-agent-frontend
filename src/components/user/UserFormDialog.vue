<template>
    <el-dialog v-model="visible" title="新增用户" width="480px" :close-on-click-modal="false" @close="handleClose">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" label-position="right">
            <el-form-item label="用户名" prop="username">
                <el-input v-model="form.username" placeholder="小写字母、数字、连字符" />
                <div class="form-hint">创建后不可修改，用于登录</div>
            </el-form-item>

            <el-form-item label="密码" prop="password">
                <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
            </el-form-item>

            <el-form-item label="角色" prop="role">
                <el-select v-model="form.role" style="width: 100%">
                    <el-option label="管理员（ADMIN）—— 全部权限" value="ADMIN" />
                    <el-option label="操作员（OPERATOR）—— 可注册/编辑服务" value="OPERATOR" />
                    <el-option label="查看者（VIEWER）—— 只读" value="VIEWER" />
                </el-select>
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
                <el-input v-model="form.phone" placeholder="可选" />
            </el-form-item>

            <el-form-item label="邮箱" prop="email">
                <el-input v-model="form.email" placeholder="可选" />
            </el-form-item>
        </el-form>

        <template #footer>
            <el-button @click="handleClose">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="handleSubmit">
                创建
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
    username: '',
    password: '',
    role: 'OPERATOR',
    phone: '',
    email: ''
})

const rules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字、连字符', trigger: 'blur' },
        { min: 2, max: 64, message: '长度 2-64 位', trigger: 'blur' }
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
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

    submitting.value = true
    try {
        // 传递给父组件，由父组件负责调用 API
        emit('success', { ...form })
        visible.value = false
    } catch (error) {
        ElMessage.error(error.message || '创建失败')
    } finally {
        submitting.value = false
    }
}

function handleClose() {
    visible.value = false
    if (formRef.value) {
        formRef.value.resetFields()
    }
    // 重置表单
    Object.assign(form, {
        username: '',
        password: '',
        role: 'OPERATOR',
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