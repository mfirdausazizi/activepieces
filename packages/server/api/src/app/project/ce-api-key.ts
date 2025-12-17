/**
 * Community Edition API Key Types and Service
 * 
 * Simplified API key management for CE external integrations.
 * This is a CE-only implementation that doesn't depend on EE packages.
 */

import { cryptoUtils } from '@activepieces/server-shared'
import {
    ActivepiecesError,
    apId,
    ApId,
    BaseModelSchema,
    ErrorCode,
    isNil,
    secureApId,
} from '@activepieces/shared'
import { Static, Type } from '@sinclair/typebox'
import { EntitySchema } from 'typeorm'
import { ApIdSchema, BaseColumnSchemaPart } from '../database/database-common'
import { repoFactory } from '../core/db/repo-factory'

// ==========================================
// Types
// ==========================================

export const CeApiKey = Type.Object({
    ...BaseModelSchema,
    platformId: ApId,
    displayName: Type.String(),
    hashedValue: Type.String(),
    truncatedValue: Type.String(),
    lastUsedAt: Type.Optional(Type.String()),
})

export type CeApiKey = Static<typeof CeApiKey>

// ==========================================
// Entity (uses existing api_key table)
// ==========================================

type CeApiKeySchema = CeApiKey & {
    platform: unknown
}

export const CeApiKeyEntity = new EntitySchema<CeApiKeySchema>({
    name: 'api_key',
    columns: {
        ...BaseColumnSchemaPart,
        displayName: {
            type: String,
            nullable: false,
        },
        platformId: {
            ...ApIdSchema,
            nullable: false,
        },
        hashedValue: {
            type: String,
            nullable: false,
        },
        truncatedValue: {
            type: String,
            nullable: false,
        },
        lastUsedAt: {
            type: String,
            nullable: true,
        },
    },
    indices: [],
    relations: {
        platform: {
            type: 'many-to-one',
            target: 'platform',
            cascade: true,
            onDelete: 'CASCADE',
            joinColumn: {
                name: 'platformId',
                referencedColumnName: 'id',
                foreignKeyConstraintName: 'fk_api_key_platform_id',
            },
        },
    },
})

// ==========================================
// Repository
// ==========================================

const API_KEY_TOKEN_LENGTH = 64
const repo = repoFactory<CeApiKey>(CeApiKeyEntity)

// ==========================================
// Service
// ==========================================

export const ceApiKeyService = {
    async add({
        platformId,
        displayName,
    }: {
        platformId: string
        displayName: string
    }): Promise<CeApiKey & { value: string }> {
        const generatedApiKey = generateApiKey()
        const savedApiKey = await repo().save({
            id: apId(),
            platformId,
            displayName,
            hashedValue: generatedApiKey.secretHashed,
            truncatedValue: generatedApiKey.secretTruncated,
        })
        return {
            ...savedApiKey,
            value: generatedApiKey.secret,
        }
    },
    
    async getByValueOrThrow(key: string): Promise<CeApiKey> {
        if (isNil(key)) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHENTICATION,
                params: { message: 'missing api key' },
            })
        }
        
        const apiKey = await repo().findOneBy({
            hashedValue: cryptoUtils.hashSHA256(key),
        })
        
        if (isNil(apiKey)) {
            throw new ActivepiecesError({
                code: ErrorCode.AUTHENTICATION,
                params: { message: 'invalid api key' },
            })
        }
        
        await repo().update(apiKey.id, {
            lastUsedAt: new Date().toISOString(),
        })
        
        return apiKey
    },
    
    async list({ platformId }: { platformId: string }): Promise<CeApiKey[]> {
        return repo().findBy({ platformId })
    },
    
    async delete({ platformId, id }: { platformId: string; id: string }): Promise<void> {
        const apiKey = await repo().findOneBy({ platformId, id })
        if (isNil(apiKey)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: { message: `api key with id ${id} not found` },
            })
        }
        await repo().delete({ platformId, id })
    },
}

function generateApiKey() {
    const secretValue = secureApId(API_KEY_TOKEN_LENGTH - 3)
    const secretKey = `sk-${secretValue}`
    return {
        secret: secretKey,
        secretHashed: cryptoUtils.hashSHA256(secretKey),
        secretTruncated: secretKey.slice(-4),
    }
}
