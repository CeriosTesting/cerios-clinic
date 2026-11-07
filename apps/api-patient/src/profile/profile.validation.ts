/** Fields of a profile update that are validated on the server. */
export interface ProfileInput {
	firstName?: string;
	lastName?: string;
	dateOfBirth?: string;
	phone?: string;
	insuranceNumber?: string;
}

export const PHONE_REGEX = /^[+\d\s\-().]{7,20}$/;

export function isInvalidDateOfBirth(dateOfBirth: string, now: Date = new Date()): boolean {
	const dob = new Date(dateOfBirth);
	return isNaN(dob.getTime()) || dob >= now;
}

/** Returns all validation errors for a profile update (empty when valid). Absent fields are not checked. */
export function validateProfileDto(dto: ProfileInput): string[] {
	const errors: string[] = [];
	if (dto.firstName !== undefined && (dto.firstName.trim().length === 0 || dto.firstName.length > 50)) {
		errors.push("First name is required and must be at most 50 characters");
	}
	if (dto.lastName !== undefined && (dto.lastName.trim().length === 0 || dto.lastName.length > 50)) {
		errors.push("Last name is required and must be at most 50 characters");
	}
	if (dto.phone !== undefined && dto.phone !== "" && !PHONE_REGEX.test(dto.phone)) {
		errors.push("Invalid phone number format");
	}
	if (dto.dateOfBirth !== undefined && dto.dateOfBirth !== "" && isInvalidDateOfBirth(dto.dateOfBirth)) {
		errors.push("Date of birth must be a valid date in the past");
	}
	if (dto.insuranceNumber !== undefined && dto.insuranceNumber.length > 30) {
		errors.push("Insurance number must be at most 30 characters");
	}
	return errors;
}
