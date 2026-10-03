import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { ImageAsset } from "@/lib/domain/types";
import { assertValidImageAsset } from "@/lib/domain/validation";
import { newId, writeTransaction, type NewEntity } from "./shared";

export type NewImageAsset = NewEntity<ImageAsset>;

/** Image binaries, stored as Blobs. Downscaling happens before calling `create`. */
export function createImageRepository(db: TravelDatabase) {
  return {
    get(id: string): Promise<ImageAsset | undefined> {
      return db.images.get(id);
    },

    async create(input: NewImageAsset): Promise<ImageAsset> {
      const now = nowInstant();
      const image: ImageAsset = { ...input, id: newId(), createdAt: now, updatedAt: now };
      assertValidImageAsset(image);
      await db.images.add(image);
      return image;
    },

    /** Deletes the image and clears trip cover references to it. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        const updatedAt = nowInstant();
        await db.trips
          .filter((trip) => trip.coverImageId === id)
          .modify((trip) => {
            delete trip.coverImageId;
            trip.updatedAt = updatedAt;
          });
        await db.images.delete(id);
      });
    },
  };
}

export type ImageRepository = ReturnType<typeof createImageRepository>;
