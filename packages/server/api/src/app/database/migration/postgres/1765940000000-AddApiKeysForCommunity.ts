import { ApEdition } from '@activepieces/shared'
import { MigrationInterface, QueryRunner } from 'typeorm'
import { isNotOneOfTheseEditions } from '../../database-common'

/**
 * This migration adds API keys table for Community Edition.
 * The original migration (1701716639135-AddApiKeys) only runs for Cloud/Enterprise.
 * This enables external integrations like OruCRM to authenticate with CE.
 */
export class AddApiKeysForCommunity1765940000000 implements MigrationInterface {
    name = 'AddApiKeysForCommunity1765940000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Only run for Community Edition
        if (isNotOneOfTheseEditions([ApEdition.COMMUNITY])) {
            return
        }
        
        // Check if table already exists (in case someone upgraded from EE)
        const tableExists = await queryRunner.hasTable('api_key')
        if (tableExists) {
            return
        }
        
        await queryRunner.query(`
            CREATE TABLE "api_key" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "displayName" character varying NOT NULL,
                "platformId" character varying(21) NOT NULL,
                "hashedValue" character varying NOT NULL,
                "truncatedValue" character varying NOT NULL,
                "lastUsedAt" character varying,
                CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id")
            )
        `)
        await queryRunner.query(`
            ALTER TABLE "api_key"
            ADD CONSTRAINT "fk_api_key_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (isNotOneOfTheseEditions([ApEdition.COMMUNITY])) {
            return
        }
        
        const tableExists = await queryRunner.hasTable('api_key')
        if (!tableExists) {
            return
        }
        
        await queryRunner.query(`
            ALTER TABLE "api_key" DROP CONSTRAINT "fk_api_key_platform_id"
        `)
        await queryRunner.query(`
            DROP TABLE "api_key"
        `)
    }
}
