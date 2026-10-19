import { Injectable } from '@nestjs/common';

export const EXTERNAL_PLATFORM = Symbol('EXTERNAL_PLATFORM');
export interface ExternalApplication {
  externalId: string; externalActivityId: string; externalPersonId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  changedAt: string; version: string;
}
export interface ExternalPlatformAdapter {
  readonly name: string;
  readonly connected: boolean;
  fetchApplications(cursor?: string): Promise<{ records: ExternalApplication[]; nextCursor?: string }>;
}

@Injectable()
export class MockPlatformAdapter implements ExternalPlatformAdapter {
  readonly name = '外部志愿平台';
  readonly connected = false;
  async fetchApplications(_cursor?: string) { return { records: [] }; }
}
