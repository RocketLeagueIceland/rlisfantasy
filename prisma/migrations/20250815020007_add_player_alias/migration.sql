BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[PlayerAlias] (
    [id] NVARCHAR(1000) NOT NULL,
    [playerId] NVARCHAR(1000) NOT NULL,
    [alias] VARCHAR(120) NOT NULL,
    CONSTRAINT [PlayerAlias_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [PlayerAlias_alias_key] UNIQUE NONCLUSTERED ([alias])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [PlayerAlias_alias_idx] ON [dbo].[PlayerAlias]([alias]);

-- AddForeignKey
ALTER TABLE [dbo].[PlayerAlias] ADD CONSTRAINT [PlayerAlias_playerId_fkey] FOREIGN KEY ([playerId]) REFERENCES [dbo].[Player]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
