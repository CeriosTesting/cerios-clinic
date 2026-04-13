import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

import { readEnvOrDefault, parsePortEnv } from "./env";

export interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
}

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private readonly transporter: nodemailer.Transporter;
	private readonly from: string;

	constructor() {
		const host = readEnvOrDefault("SMTP_HOST", "localhost");
		const port = parsePortEnv("SMTP_PORT", 1025);
		this.from = readEnvOrDefault("SMTP_FROM", "noreply@clinic.local");

		this.transporter = nodemailer.createTransport({
			host,
			port,
			secure: false,
		});
	}

	async send(options: SendMailOptions): Promise<void> {
		try {
			await this.transporter.sendMail({
				from: this.from,
				to: options.to,
				subject: options.subject,
				html: options.html,
			});
			this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
		} catch (error) {
			this.logger.error(`Failed to send email to ${options.to}`, error);
		}
	}

	async sendAppointmentConfirmation(
		patientEmail: string,
		patientName: string,
		doctorName: string,
		scheduledAt: Date
	): Promise<void> {
		const date = scheduledAt.toLocaleDateString("en-NL", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});
		const time = scheduledAt.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

		await this.send({
			to: patientEmail,
			subject: "Appointment Confirmed - Cerios Clinic",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #1A2238;">Appointment Confirmed</h2>
					<p>Dear ${patientName},</p>
					<p>Your appointment has been confirmed with the following details:</p>
					<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Doctor</td><td style="padding: 8px; border: 1px solid #ddd;">Dr. ${doctorName}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Date</td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time</td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
					</table>
					<p>If you need to reschedule or cancel, please log in to the patient portal or call the clinic.</p>
					<p style="color: #666; font-size: 12px; margin-top: 32px;">Cerios Clinic &bull; This is an automated message.</p>
				</div>
			`,
		});
	}

	async sendAppointmentCancellation(
		recipientEmail: string,
		recipientName: string,
		doctorName: string,
		patientName: string,
		scheduledAt: Date
	): Promise<void> {
		const date = scheduledAt.toLocaleDateString("en-NL", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});
		const time = scheduledAt.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

		await this.send({
			to: recipientEmail,
			subject: "Appointment Cancelled - Cerios Clinic",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #1A2238;">Appointment Cancelled</h2>
					<p>Dear ${recipientName},</p>
					<p>The following appointment has been cancelled:</p>
					<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Doctor</td><td style="padding: 8px; border: 1px solid #ddd;">Dr. ${doctorName}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Patient</td><td style="padding: 8px; border: 1px solid #ddd;">${patientName}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Date</td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time</td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
					</table>
					<p>If you have any questions, please contact the clinic.</p>
					<p style="color: #666; font-size: 12px; margin-top: 32px;">Cerios Clinic &bull; This is an automated message.</p>
				</div>
			`,
		});
	}

	async sendAppointmentReminder(
		patientEmail: string,
		patientName: string,
		doctorName: string,
		scheduledAt: Date
	): Promise<void> {
		const time = scheduledAt.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

		await this.send({
			to: patientEmail,
			subject: "Appointment Reminder - Tomorrow - Cerios Clinic",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #1A2238;">Appointment Reminder</h2>
					<p>Dear ${patientName},</p>
					<p>This is a friendly reminder that you have an appointment <strong>tomorrow</strong>:</p>
					<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Doctor</td><td style="padding: 8px; border: 1px solid #ddd;">Dr. ${doctorName}</td></tr>
						<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time</td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
					</table>
					<p>Please arrive 10 minutes before your scheduled time.</p>
					<p style="color: #666; font-size: 12px; margin-top: 32px;">Cerios Clinic &bull; This is an automated message.</p>
				</div>
			`,
		});
	}

	async sendWelcome(patientEmail: string, patientName: string): Promise<void> {
		await this.send({
			to: patientEmail,
			subject: "Welcome to Cerios Clinic",
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #1A2238;">Welcome to Cerios Clinic!</h2>
					<p>Dear ${patientName},</p>
					<p>Thank you for registering with Cerios Clinic. Your account has been created successfully.</p>
					<p>You can now:</p>
					<ul>
						<li>Browse our doctors and their specializations</li>
						<li>View and manage your appointments</li>
						<li>Access your medical history</li>
						<li>Update your profile information</li>
					</ul>
					<p>If you have any questions, please don't hesitate to contact us.</p>
					<p style="color: #666; font-size: 12px; margin-top: 32px;">Cerios Clinic &bull; This is an automated message.</p>
				</div>
			`,
		});
	}
}
