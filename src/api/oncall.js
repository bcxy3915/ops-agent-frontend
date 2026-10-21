import request from './request'

/** P1：值班管理 */
export function listOncallMembers(dutyRole) {
  return request.get('/oncall/members', { params: dutyRole ? { dutyRole } : {} })
}
export function addOncallMember(data) {
  return request.post('/oncall/members', data)
}
export function removeOncallMember(id) {
  return request.delete(`/oncall/members/${id}`)
}
