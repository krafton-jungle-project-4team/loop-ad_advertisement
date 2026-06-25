import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { adClickRequestSchema } from '../dto/ad-click-request.dto';
import { AdClickService } from '../services/ad-click.service';

@Controller()
export class AdClickController {
  constructor(private readonly adClickService: AdClickService) {}

  @Post('/v1/ad-click')
  @HttpCode(200)
  async click(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = adClickRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.adClickService.click(parsed.data.tracking_token);
  }
}
