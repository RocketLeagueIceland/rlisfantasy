/*
  Warnings:

  - A unique constraint covering the columns `[playerId,weekId]` on the table `PlayerGameStat` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[PlayerGameStat] DROP CONSTRAINT [PlayerGameStat_assists_df],
[PlayerGameStat_demos_df],
[PlayerGameStat_goals_df],
[PlayerGameStat_saves_df],
[PlayerGameStat_score_df],
[PlayerGameStat_shots_df];
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [goals] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [assists] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [saves] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [shots] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [demos] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ALTER COLUMN [score] FLOAT(53) NOT NULL;
ALTER TABLE [dbo].[PlayerGameStat] ADD CONSTRAINT [PlayerGameStat_assists_df] DEFAULT 0 FOR [assists], CONSTRAINT [PlayerGameStat_demos_df] DEFAULT 0 FOR [demos], CONSTRAINT [PlayerGameStat_goals_df] DEFAULT 0 FOR [goals], CONSTRAINT [PlayerGameStat_saves_df] DEFAULT 0 FOR [saves], CONSTRAINT [PlayerGameStat_score_df] DEFAULT 0 FOR [score], CONSTRAINT [PlayerGameStat_shots_df] DEFAULT 0 FOR [shots];
ALTER TABLE [dbo].[PlayerGameStat] ADD [games] INT NOT NULL CONSTRAINT [PlayerGameStat_games_df] DEFAULT 1;

-- CreateIndex
ALTER TABLE [dbo].[PlayerGameStat] ADD CONSTRAINT [PlayerGameStat_playerId_weekId_key] UNIQUE NONCLUSTERED ([playerId], [weekId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
