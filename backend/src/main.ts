import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { HttpAdapterHost } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { RequestAbortedFilter } from "./common/filters/request-aborted.filter";
import { AppModule } from "./app.module";
import { assertProductionSecurity } from "./bootstrap-security";

function shouldEnableSwagger(): boolean {
  if (process.env.SWAGGER_ENABLED === "true") {
    return true;
  }
  if (process.env.SWAGGER_ENABLED === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  assertProductionSecurity();

  const http = app.getHttpAdapter().getInstance();
  const trustProxy =
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    process.env.NODE_ENV === "production";
  http.set("trust proxy", trustProxy ? 1 : false);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false
    })
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new RequestAbortedFilter(app.get(HttpAdapterHost)));

  if (shouldEnableSwagger()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Code Analysis API")
      .setDescription("API для анализа студенческих работ")
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        "bearer"
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true
      }
    });
  }

  const server = await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
  const requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 0);
  if (Number.isFinite(requestTimeout) && requestTimeout >= 0) {
    server.requestTimeout = requestTimeout;
  }
}

bootstrap();
