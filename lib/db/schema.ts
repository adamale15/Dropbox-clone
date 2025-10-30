import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),

  //basic file and folder information
  name: text("name").notNull(),
  path: text("path").notNull(), // /document/project/resume
  size: integer("size").notNull(),
  type: text("type").notNull(), // "folder"

  //storage information
  fileUrl: text("file_url").notNull(), // URL to access file
  thumbnailUrl: text("thumbnail_url"),

  //Ownership information
  userId: text("user_id").notNull(),
  parentId: uuid("parent_id"), // Parent folder id if (null for root items)

  //file/folder flags
  isFolder: boolean("is_folder").default(false).notNull(),
  isStarred: boolean("is_starred").default(false).notNull(),
  isTrash: boolean("is_trash").default(false).notNull(),

  //Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* 
parent: Each file/folder can have one parent folder
children: Each folder can have many child files/folder
*/

export const fileRelations = relations(files, ({ one, many }) => ({
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
  }),
  children: many(files),
}));

// Type definitions
export const File = typeof files.$inferSelect;
export const NewFile = typeof files.$inferInsert;
