BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[TransferLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [teamId] NVARCHAR(1000) NOT NULL,
    [weekId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TransferLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [TransferLog_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TransferLog_teamId_weekId_key] UNIQUE NONCLUSTERED ([teamId],[weekId])
);

-- AddForeignKey
ALTER TABLE [dbo].[TransferLog] ADD CONSTRAINT [TransferLog_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TransferLog] ADD CONSTRAINT [TransferLog_weekId_fkey] FOREIGN KEY ([weekId]) REFERENCES [dbo].[Week]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
