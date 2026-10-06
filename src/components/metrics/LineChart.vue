<template>
    <div ref="chartRef" class="line-chart"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    // 数据格式：[{ time: ISOString, value: number }]
    data: { type: Array, default: () => [] },
    // 单位
    unit: { type: String, default: '' },
    // 线条颜色
    color: { type: String, default: '#3B82F6' },
    // 高度
    height: { type: String, default: '240px' },
    // Y 轴小数位
    precision: { type: Number, default: 2 }
})

const chartRef = ref(null)
let chart = null

function initChart() {
    if (!chartRef.value) return

    chart = echarts.init(chartRef.value)

    chart.setOption({
        grid: {
            left: 12,
            right: 16,
            top: 20,
            bottom: 24,
            containLabel: true
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: '#E5E9F0',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#1E293B', fontSize: 12 },
            formatter: (params) => {
                const p = params[0]
                const time = new Date(p.value[0]).toLocaleTimeString()
                const val = Number(p.value[1]).toFixed(props.precision)
                return `${time}<br/><b>${val}</b> ${props.unit}`
            }
        },
        xAxis: {
            type: 'time',
            axisLine: { lineStyle: { color: '#E5E9F0' } },
            axisLabel: {
                color: '#94A3B8',
                fontSize: 11,
                formatter: (val) => {
                    const d = new Date(val)
                    const pad = (n) => String(n).padStart(2, '0')
                    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
                }
            },
            splitLine: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
                color: '#94A3B8',
                fontSize: 11,
                formatter: (val) => Number(val).toFixed(props.precision)
            },
            splitLine: {
                lineStyle: { color: '#F1F5F9', type: 'dashed' }
            }
        },
        series: [
            {
                type: 'line',
                smooth: true,
                showSymbol: false,
                lineStyle: { color: props.color, width: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: hexToRgba(props.color, 0.25) },
                        { offset: 1, color: hexToRgba(props.color, 0.02) }
                    ])
                },
                data: []
            }
        ]
    })

    updateData()
    window.addEventListener('resize', resize)
}

function updateData() {
    if (!chart) return
    const seriesData = props.data.map((d) => [new Date(d.time).getTime(), d.value])
    chart.setOption({
        series: [{ data: seriesData }]
    })
}

function resize() {
    if (chart) chart.resize()
}

onMounted(() => {
    nextTick(() => initChart())
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    if (chart) {
        chart.dispose()
        chart = null
    }
})

watch(() => props.data, () => updateData(), { deep: true })

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
</script>

<style scoped>
.line-chart {
    width: 100%;
    height: v-bind(height);
}
</style>