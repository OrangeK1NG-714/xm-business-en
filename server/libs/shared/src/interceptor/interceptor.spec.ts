import type { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { InterceptorInterceptor } from './interceptor';
import { ResponseService } from '../response/response.service';

describe('course response interceptor', () => {
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ url: '/test' }) }),
  } as unknown as ExecutionContext;

  it('retains the course success flag for a ResponseService business error', async () => {
    const interceptor = new InterceptorInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of(new ResponseService().error(null, '手机号不存在')),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      code: 500,
      message: '手机号不存在',
      data: null,
      path: '/test',
    });
    expect(result.timestamp).toEqual(expect.any(String));
  });

  it('converts nested bigint values while retaining Date objects before JSON serialization', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const interceptor = new InterceptorInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          of(
            new ResponseService().success({
              id: BigInt(42),
              records: [{ total: BigInt(99) }],
              createdAt,
            }),
          ),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      code: 200,
      message: 'success',
      data: { id: '42', records: [{ total: '99' }], createdAt },
    });
    expect(result.data.createdAt).toBe(createdAt);
  });
});
