import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AppLoggerService } from './app-logger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggingModule {}
