export { ValidationError } from "@/lib/domain/validation";

export class EntityNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} does not exist`);
    this.name = "EntityNotFoundError";
  }
}

/** A referenced record is missing or belongs to another trip. */
export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReferenceError";
  }
}

/** The change conflicts with existing data (e.g. a duplicate TripDay date). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
