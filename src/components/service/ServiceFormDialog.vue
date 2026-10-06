<template>
    <el-dialog v-model="visible" :title="isEdit ? '编辑服务' : '注册服务'" width="520px" :close-on-click-modal="false"
        @close="handleClose">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="right">
            <el-form-item label="服务名" prop="name">
                <el-input v-model="form.name" placeholder="例如：todo-service" :disabled="isEdit" />
                <div class="form-hint">小写字母、数字、连字符</div>
            </el-form-item>

            <el-form-item label="基础地址" prop="baseUrl">
                <el-input v-model="form.baseUrl" placeholder="例如：http://localhost:8081" />
            </el-form-item>

            <el-form-item label="健康检查" prop="healthPath">
                <el-input v-model="form.healthPath" placeholder="/actuator/health" />
            </el-form-item>

            <el-form-item label="指标路径" prop="metricsPath">
                <el-input v-model="form.metricsPath" placeholder="/actuator/metrics" />
            </el-form-item>

            <el-form-item label="负责人" prop="owner">
                <el-input v-model="form.owner" placeholder="例如：张三" />
            </el-form-item>

            <el-form-item label="环境" prop="env">
                <el-select v-model="form.env" style="width: 100%">
                    <el-option label="开发（dev）" value="dev" />
                    <el-option label="测试（test）" value="test" />
                    <el-option label="生产（prod）" value="prod" />
                </el-select>
            </el-form-item>
        </el-form>

        <template #footer>
            <el-button @click="handleClose">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="handleSubmit">
                {{ isEdit ? '保存' : '注册' }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    service: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'success'])

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

const isEdit = computed(() => !!props.service)

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
    name: '',
    baseUrl: '',
    healthPath: '/actuator/health',
    metricsPath: '/actuator/metrics',
    owner: '',
    env: 'dev'
})

const rules = {
    name: [
        { required: true, message: '请输入服务名', trigger: 'blur' },
        { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字、连字符', trigger: 'blur' }
    ],
    baseUrl: [
        { required: true, message: '请输入基础地址', trigger: 'blur' },
        { pattern: /^https?:\/\/.+/, message: '必须以 http:// 或 https:// 开头', trigger: 'blur' }
    ]
}

// 打开时填充数据
watch(
    () => props.modelValue,
    (open) => {
        if (open) {
            if (props.service) {
                // 编辑模式
                Object.assign(form, {
                    name: props.service.name,
                    baseUrl: props.service.baseUrl,
                    healthPath: props.service.healthPath || '/actuator/health',
                    metricsPath: props.service.metricsPath || '/actuator/metrics',
                    owner: props.service.owner || '',
                    env: props.service.env || 'dev'
                })
            } else {
                // 新建模式：重置
                Object.assign(form, {
                    name: '',
                    baseUrl: '',
                    healthPath: '/actuator/health',
                    metricsPath: '/actuator/metrics',
                    owner: '',
                    env: 'dev'
                })
            }
        }
    }
)

async function handleSubmit() {
    if (!formRef.value) return
    try {
        await formRef.value.validate()
    } catch {
        return
    }

    submitting.value = true
    try {
        emit('success', { ...form, isEdit: isEdit.value })
        visible.value = false
    } catch (error) {
        ElMessage.error(error.message || '操作失败')
    } finally {
        submitting.value = false
    }
}

function handleClose() {
    visible.value = false
    if (formRef.value) formRef.value.resetFields()
}
</script>

<style scoped>
.form-hint {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 4px;
}
</style>