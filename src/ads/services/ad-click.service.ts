import { Injectable } from '@nestjs/common';
import { AdEventEmitter } from './ad-event-emitter.service';
import { AdTokenService } from './ad-token.service';

@Injectable()
export class AdClickService {
  constructor(
    private readonly adTokenService: AdTokenService,
    private readonly adEventEmitter: AdEventEmitter,
  ) {}

  async click(trackingToken: string): Promise<{ ok: true }> {
    const payload = this.adTokenService.verify(trackingToken);

    await this.adEventEmitter.emit({
      event_type: 'ad_click',
      project_id: payload.project_id,
      slot_id: payload.slot_id,
      campaign_id: payload.campaign_id,
      creative_id: payload.creative_id,
      variant: payload.variant,
      user_id: payload.user_id,
      session_id: payload.session_id,
    });

    return { ok: true };
  }
}
