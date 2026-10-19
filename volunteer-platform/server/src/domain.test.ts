import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDateRange, maskPhone, serviceDate, splitMinutes, summarize, type ReportRow } from './domain.js';
import { buildWorkbook } from './reporting.js';

test('服务日期使用上海时区', () => { assert.equal(serviceDate(new Date('2026-10-31T16:01:00Z')), '2026-11-01'); });
test('跨月场次拆分分钟，核定总数保持一致', () => {
  const rows = splitMinutes(new Date('2026-10-31T23:30:00+08:00'), new Date('2026-11-01T01:00:00+08:00'), 75);
  assert.deepEqual(rows, [{ serviceDate: '2026-10-31', minutes: 25 }, { serviceDate: '2026-11-01', minutes: 50 }]);
});
test('拒绝负时长、超时长、小数时长和反向时间', () => {
  for (const minutes of [-1, 0, 91, 30.5]) assert.throws(() => splitMinutes(new Date('2026-10-19T09:00:00+08:00'), new Date('2026-10-19T10:30:00+08:00'), minutes));
  assert.throws(() => splitMinutes(new Date('2026-10-19'), new Date('2026-10-18'), 60));
});
test('日期区间校验拒绝无效日历日期和逆序', () => {
  assert.doesNotThrow(() => assertDateRange('2026-10-01', '2026-10-31'));
  for (const pair of [['2026-02-30','2026-03-01'],['2026-11-01','2026-10-01'],['foo','bar']]) assert.throws(() => assertDateRange(pair[0], pair[1]));
});
const base: ReportRow = { userId: 'u1', name: '测试志愿者', number: 'TEST-001', department: '测试部门', activityId: 'a1', activity: '测试活动', sessionId: 's1', session: '跨天场', serviceDate: '2026-10-31', minutes: 25 };
test('汇总按活动、场次去重，先累加分钟', () => {
  const result = summarize([base, { ...base, serviceDate: '2026-11-01', minutes: 50 }, { ...base, sessionId: 's2', minutes: 25 }]);
  assert.equal(result.people[0].activityCount, 1); assert.equal(result.people[0].sessionCount, 2); assert.equal(result.people[0].minutes, 100); assert.equal(result.totalMinutes, 100);
});
test('Excel 实际序列化保留三张表、明细和汇总', async () => {
  const workbook = buildWorkbook([base], { from: '2026-10-01', to: '2026-10-31' }, new Date());
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000); assert.equal(workbook.worksheets.length, 3);
  assert.equal(workbook.getWorksheet('人员活动明细')?.getRow(2).getCell('minutes').value, 25);
  assert.equal(workbook.getWorksheet('人员汇总')?.getRow(2).getCell('minutes').value, 25);
});
test('手机号返回脱敏格式', () => assert.equal(maskPhone('13812345678'), '138****5678'));
