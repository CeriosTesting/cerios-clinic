import "reflect-metadata";

import { Logger } from "@nestjs/common";

// Keep test output readable: services log on purpose (e.g. "Email sent", "Failed to send").
Logger.overrideLogger(false);
