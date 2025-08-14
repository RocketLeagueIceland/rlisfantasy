BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [name] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [emailVerified] DATETIME2,
    [image] NVARCHAR(1000),
    [role] VARCHAR(16) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'USER',
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Account] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [providerAccountId] NVARCHAR(1000) NOT NULL,
    [refresh_token] TEXT,
    [access_token] TEXT,
    [expires_at] INT,
    [token_type] NVARCHAR(1000),
    [scope] NVARCHAR(1000),
    [id_token] TEXT,
    [session_state] NVARCHAR(1000),
    CONSTRAINT [Account_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Account_provider_providerAccountId_key] UNIQUE NONCLUSTERED ([provider],[providerAccountId])
);

-- CreateTable
CREATE TABLE [dbo].[Session] (
    [id] NVARCHAR(1000) NOT NULL,
    [sessionToken] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    CONSTRAINT [Session_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Session_sessionToken_key] UNIQUE NONCLUSTERED ([sessionToken])
);

-- CreateTable
CREATE TABLE [dbo].[VerificationToken] (
    [identifier] NVARCHAR(1000) NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    CONSTRAINT [VerificationToken_token_key] UNIQUE NONCLUSTERED ([token]),
    CONSTRAINT [VerificationToken_identifier_token_key] UNIQUE NONCLUSTERED ([identifier],[token])
);

-- CreateTable
CREATE TABLE [dbo].[RLTeam] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] VARCHAR(120) NOT NULL,
    [short] VARCHAR(12),
    CONSTRAINT [RLTeam_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Player] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] VARCHAR(120) NOT NULL,
    [rlTeamId] NVARCHAR(1000),
    [price] INT NOT NULL CONSTRAINT [Player_price_df] DEFAULT 10,
    CONSTRAINT [Player_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Week] (
    [id] NVARCHAR(1000) NOT NULL,
    [number] INT NOT NULL,
    [startDate] DATETIME2 NOT NULL,
    [firstBroadcastAt] DATETIME2 NOT NULL,
    [unlockedAt] DATETIME2 NOT NULL,
    [isLocked] BIT NOT NULL CONSTRAINT [Week_isLocked_df] DEFAULT 0,
    CONSTRAINT [Week_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Week_number_key] UNIQUE NONCLUSTERED ([number])
);

-- CreateTable
CREATE TABLE [dbo].[TeamWeek] (
    [id] NVARCHAR(1000) NOT NULL,
    [rlTeamId] NVARCHAR(1000) NOT NULL,
    [weekId] NVARCHAR(1000) NOT NULL,
    [games] INT NOT NULL,
    CONSTRAINT [TeamWeek_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TeamWeek_rlTeamId_weekId_key] UNIQUE NONCLUSTERED ([rlTeamId],[weekId])
);

-- CreateTable
CREATE TABLE [dbo].[Game] (
    [id] NVARCHAR(1000) NOT NULL,
    [weekId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    CONSTRAINT [Game_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PlayerGameStat] (
    [id] NVARCHAR(1000) NOT NULL,
    [playerId] NVARCHAR(1000) NOT NULL,
    [weekId] NVARCHAR(1000) NOT NULL,
    [gameId] NVARCHAR(1000),
    [goals] INT NOT NULL CONSTRAINT [PlayerGameStat_goals_df] DEFAULT 0,
    [assists] INT NOT NULL CONSTRAINT [PlayerGameStat_assists_df] DEFAULT 0,
    [saves] INT NOT NULL CONSTRAINT [PlayerGameStat_saves_df] DEFAULT 0,
    [shots] INT NOT NULL CONSTRAINT [PlayerGameStat_shots_df] DEFAULT 0,
    [demos] INT NOT NULL CONSTRAINT [PlayerGameStat_demos_df] DEFAULT 0,
    CONSTRAINT [PlayerGameStat_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Team] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [name] VARCHAR(80) NOT NULL,
    [budgetInitial] INT NOT NULL CONSTRAINT [Team_budgetInitial_df] DEFAULT 100,
    [budgetSpent] INT NOT NULL CONSTRAINT [Team_budgetSpent_df] DEFAULT 0,
    CONSTRAINT [Team_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Team_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[TeamPlayer] (
    [id] NVARCHAR(1000) NOT NULL,
    [teamId] NVARCHAR(1000) NOT NULL,
    [playerId] NVARCHAR(1000) NOT NULL,
    [pricePaid] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [TeamPlayer_isActive_df] DEFAULT 0,
    [activeOrder] INT,
    [benchOrder] INT,
    [role] VARCHAR(16),
    CONSTRAINT [TeamPlayer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TeamPlayer_teamId_playerId_key] UNIQUE NONCLUSTERED ([teamId],[playerId])
);

-- CreateTable
CREATE TABLE [dbo].[TeamWeekScore] (
    [id] NVARCHAR(1000) NOT NULL,
    [teamId] NVARCHAR(1000) NOT NULL,
    [weekId] NVARCHAR(1000) NOT NULL,
    [points] INT NOT NULL CONSTRAINT [TeamWeekScore_points_df] DEFAULT 0,
    [breakdown] TEXT NOT NULL,
    CONSTRAINT [TeamWeekScore_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TeamWeekScore_teamId_weekId_key] UNIQUE NONCLUSTERED ([teamId],[weekId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlayerGameStat_playerId_weekId_idx] ON [dbo].[PlayerGameStat]([playerId], [weekId]);

-- AddForeignKey
ALTER TABLE [dbo].[Account] ADD CONSTRAINT [Account_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Session] ADD CONSTRAINT [Session_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Player] ADD CONSTRAINT [Player_rlTeamId_fkey] FOREIGN KEY ([rlTeamId]) REFERENCES [dbo].[RLTeam]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamWeek] ADD CONSTRAINT [TeamWeek_rlTeamId_fkey] FOREIGN KEY ([rlTeamId]) REFERENCES [dbo].[RLTeam]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamWeek] ADD CONSTRAINT [TeamWeek_weekId_fkey] FOREIGN KEY ([weekId]) REFERENCES [dbo].[Week]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Game] ADD CONSTRAINT [Game_weekId_fkey] FOREIGN KEY ([weekId]) REFERENCES [dbo].[Week]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlayerGameStat] ADD CONSTRAINT [PlayerGameStat_playerId_fkey] FOREIGN KEY ([playerId]) REFERENCES [dbo].[Player]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[PlayerGameStat] ADD CONSTRAINT [PlayerGameStat_weekId_fkey] FOREIGN KEY ([weekId]) REFERENCES [dbo].[Week]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlayerGameStat] ADD CONSTRAINT [PlayerGameStat_gameId_fkey] FOREIGN KEY ([gameId]) REFERENCES [dbo].[Game]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Team] ADD CONSTRAINT [Team_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamPlayer] ADD CONSTRAINT [TeamPlayer_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamPlayer] ADD CONSTRAINT [TeamPlayer_playerId_fkey] FOREIGN KEY ([playerId]) REFERENCES [dbo].[Player]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamWeekScore] ADD CONSTRAINT [TeamWeekScore_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamWeekScore] ADD CONSTRAINT [TeamWeekScore_weekId_fkey] FOREIGN KEY ([weekId]) REFERENCES [dbo].[Week]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
