import { HttpAdapterHost, NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { IConfig } from "./infrastructure"
import { AllExceptionsFilter } from "./lib"
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import * as express from "express"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = await app.resolve(IConfig)
  const port = config.get<number>("http.port")

  // Increase payload size limit
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  app.enableVersioning({ type: VersioningType.URI })
  app.useGlobalPipes(new ValidationPipe({ transform: true }))

  setupSwagger(app)

  const { httpAdapter } = app.get(HttpAdapterHost)
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter))
  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  })

  // Start the HTTP server
  await app.listen(port)
  console.log(`Application is running on: http://localhost:${port}`)
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("AI Wize Template API")
    .setDescription("The public API for AI Wize Template service")
    .setVersion("1.0")
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => methodKey,
  })

  SwaggerModule.setup("api", app, document)
}

void bootstrap()
