CREATE TABLE `leaderboard` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`day` text DEFAULT '' NOT NULL,
	`writes` integer DEFAULT 0 NOT NULL,
	`entries` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "one_row" CHECK("leaderboard"."id" = 1)
);
