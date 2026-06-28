import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { AdDecisionService } from '../services/ad-decision.service';
import { adDecisionRequestSchema } from '../dto/ad-decision-request.dto';
import type { AdDecisionResponseDto } from '../dto/ad-decision-response.dto';

@Controller()
export class AdDecisionController {
  constructor(private readonly adDecisionService: AdDecisionService) {}

  @Post('/ads/decision')
  @HttpCode(200)
  async decide(@Body() body: unknown): Promise<AdDecisionResponseDto> {
    const parsed = adDecisionRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adDecisionService.decide(parsed.data);
  }
}
