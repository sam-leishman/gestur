import { relations } from 'drizzle-orm';
import { foreignKey, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export * from './auth.schema';



// ===========================================================================
// IMAGES
// ===========================================================================
export const images = sqliteTable('images', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	filePath: text('file_path').notNull().unique()
});

export const imagesRelations = relations(images, ({ many }) => ({
	stats: many(userImageStats),
	subjects: many(imageSubjects),
	tags: many(imageTags),
	sessionEntries: many(sessionImages)
}));



// ===========================================================================
// USER IMAGE STATS
// ===========================================================================
export const userImageStats = sqliteTable('user_image_stats', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	imageId: text('image_id').notNull().references(() => images.id, { onDelete: 'cascade' }),
	drawCount: integer('draw_count').notNull().default(0),
	skipCount: integer('skip_count').notNull().default(0),
	liked: integer('liked', { mode: 'boolean' }).notNull().default(false)
}, (table) => [unique('user_image_stats_unique').on(table.userId, table.imageId)]);

export const userImageStatsRelations = relations(userImageStats, ({ one }) => ({
	user: one(user, {
		fields: [userImageStats.userId],
		references: [user.id]
	}),
	image: one(images, {
		fields: [userImageStats.imageId],
		references: [images.id]
	})
}));



// ===========================================================================
// SUBJECTS
// ===========================================================================
export const subjects = sqliteTable('subjects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().unique()
});

export const subjectsRelations = relations(subjects, ({ many }) => ({
	fields: many(subjectFields),
	imageSubjects: many(imageSubjects)
}));



// ===========================================================================
// SUBJECT FIELDS
// ===========================================================================
export const subjectFields = sqliteTable('subject_fields', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	subjectId: text('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: text('type', { enum: ['text', 'number', 'boolean', 'select'] }).notNull(),
	options: text('options', { mode: 'json' }).$type<string[]>(),
	required: integer('required', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0)
}, (table) => [
	unique('subject_fields_unique').on(table.subjectId, table.name),
	unique('subject_fields_id_subject_unique').on(table.id, table.subjectId)
]);

export const subjectFieldsRelations = relations(subjectFields, ({ one, many }) => ({
	subject: one(subjects, {
		fields: [subjectFields.subjectId],
		references: [subjects.id]
	}),
	fieldValues: many(imageSubjectFieldValues)
}));



// ===========================================================================
// IMAGE SUBJECTS
// ===========================================================================
export const imageSubjects = sqliteTable('image_subjects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	imageId: text('image_id').notNull().references(() => images.id, { onDelete: 'cascade' }),
	subjectId: text('subject_id').notNull().references(() => subjects.id),
	label: text('label')
}, (table) => [
	unique('image_subjects_id_subject_unique').on(table.id, table.subjectId)
]);

export const imageSubjectsRelations = relations(imageSubjects, ({ one, many }) => ({
	image: one(images, {
		fields: [imageSubjects.imageId],
		references: [images.id]
	}),
	subject: one(subjects, {
		fields: [imageSubjects.subjectId],
		references: [subjects.id]
	}),
	fieldValues: many(imageSubjectFieldValues)
}));



// ===========================================================================
// IMAGE SUBJECT FIELD VALUES
// ===========================================================================
export const imageSubjectFieldValues = sqliteTable('image_subject_field_values', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	imageSubjectId: text('image_subject_id').notNull(),
	subjectId: text('subject_id').notNull(),
	subjectFieldId: text('subject_field_id').notNull(),
	value: text('value')
}, (table) => [
	unique('image_subject_field_values_unique').on(table.imageSubjectId, table.subjectFieldId),
	foreignKey({
		columns: [table.imageSubjectId, table.subjectId],
		foreignColumns: [imageSubjects.id, imageSubjects.subjectId]
	}).onDelete('cascade'),
	foreignKey({
		columns: [table.subjectFieldId, table.subjectId],
		foreignColumns: [subjectFields.id, subjectFields.subjectId]
	}).onDelete('cascade')
]);

export const imageSubjectFieldValuesRelations = relations(imageSubjectFieldValues, ({ one }) => ({
	imageSubject: one(imageSubjects, {
		fields: [imageSubjectFieldValues.imageSubjectId],
		references: [imageSubjects.id]
	}),
	subjectField: one(subjectFields, {
		fields: [imageSubjectFieldValues.subjectFieldId],
		references: [subjectFields.id]
	})
}));



// ===========================================================================
// TAGS
// ===========================================================================
export const tags = sqliteTable('tags', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull().unique()
});

export const tagsRelations = relations(tags, ({ many }) => ({
	imageTags: many(imageTags)
}));



// ===========================================================================
// IMAGE TAGS
// ===========================================================================
export const imageTags = sqliteTable('image_tags', {
	imageId: text('image_id').notNull().references(() => images.id, { onDelete: 'cascade' }),
	tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' })
}, (table) => [primaryKey({ columns: [table.imageId, table.tagId] })]);

export const imageTagsRelations = relations(imageTags, ({ one }) => ({
	image: one(images, {
		fields: [imageTags.imageId],
		references: [images.id]
	}),
	tag: one(tags, {
		fields: [imageTags.tagId],
		references: [tags.id]
	})
}));



// ===========================================================================
// USER SETTINGS
// ===========================================================================
export const userSettings = sqliteTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(30),
	browseViewMode: text('browse_view_mode', { enum: ['grid', 'list'] }).notNull().default('grid')
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(user, {
		fields: [userSettings.userId],
		references: [user.id]
	})
}));



// ===========================================================================
// SESSIONS
// ===========================================================================
export const sessions = sqliteTable('sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
	completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
	status: text('status', { enum: ['completed', 'stopped'] }).notNull(),
	targetCount: integer('target_count').notNull(),
	durationSeconds: integer('duration_seconds').notNull(),
	drawnCount: integer('drawn_count').notNull().default(0),
	skippedCount: integer('skipped_count').notNull().default(0),
	localDate: text('local_date').notNull(),
	goalMinutesSnapshot: integer('goal_minutes_snapshot').notNull()
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	user: one(user, {
		fields: [sessions.userId],
		references: [user.id]
	}),
	items: many(sessionImages)
}));



// ===========================================================================
// SESSION IMAGES
// ===========================================================================
export const sessionImages = sqliteTable('session_images', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
	imageId: text('image_id').notNull().references(() => images.id, { onDelete: 'cascade' }),
	result: text('result', { enum: ['drawn', 'skipped'] }).notNull(),
	position: integer('position').notNull()
});

export const sessionImagesRelations = relations(sessionImages, ({ one }) => ({
	session: one(sessions, {
		fields: [sessionImages.sessionId],
		references: [sessions.id]
	}),
	image: one(images, {
		fields: [sessionImages.imageId],
		references: [images.id]
	})
}));
