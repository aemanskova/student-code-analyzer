import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";

@Catch()
export class RequestAbortedFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(RequestAbortedFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") {
      super.catch(exception, host);
      return;
    }

    if (!(exception instanceof Error) || exception.message !== "Request aborted") {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<{
        headersSent?: boolean;
        status: (code: number) => { json: (body: unknown) => void };
      }>();

      if (exception instanceof HttpException) {
        const statusCode = exception.getStatus();
        const payload = exception.getResponse();

        let message: string | string[] = "Internal server error";
        let error: string | undefined;

        if (typeof payload === "string") {
          message = payload;
        } else if (payload && typeof payload === "object") {
          const body = payload as { message?: string | string[]; error?: string };
          if (body.message) {
            message = body.message;
          }
          if (body.error) {
            error = body.error;
          }
        }

        if (!response.headersSent) {
          response.status(statusCode).json({
            status: statusCode,
            statusCode,
            message,
            ...(error ? { error } : {})
          });
        }
        return;
      }

      this.logger.error(
        "Unhandled error",
        exception instanceof Error ? exception.stack : undefined
      );

      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error"
        });
      }
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      headersSent?: boolean;
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    this.logger.warn("Клиент прервал запрос во время загрузки файла");

    if (!response.headersSent) {
      response.status(HttpStatus.REQUEST_TIMEOUT).json({
        status: HttpStatus.REQUEST_TIMEOUT,
        statusCode: HttpStatus.REQUEST_TIMEOUT,
        message: "Запрос был прерван клиентом"
      });
    }
  }
}
