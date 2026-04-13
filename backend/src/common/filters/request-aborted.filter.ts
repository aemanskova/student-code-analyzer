import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch(Error)
export class RequestAbortedFilter implements ExceptionFilter {
  private readonly logger = new Logger(RequestAbortedFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    if (exception.message !== 'Request aborted') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      headersSent?: boolean;
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    this.logger.warn('Клиент прервал запрос во время загрузки файла');

    if (!response.headersSent) {
      response.status(HttpStatus.REQUEST_TIMEOUT).json({
        statusCode: HttpStatus.REQUEST_TIMEOUT,
        message: 'Запрос был прерван клиентом',
      });
    }
  }
}
