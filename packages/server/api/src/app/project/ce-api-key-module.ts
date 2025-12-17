/**
 * Community Edition API Key Module
 * 
 * Provides API key management endpoints for CE.
 */

import {
    ApId,
    PrincipalType,
    assertNotNullOrUndefined,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { platformService } from '../platform/platform.service'
import { userService } from '../user/user-service'
import { CeApiKey, ceApiKeyService } from './ce-api-key'

export const ceApiKeyModule: FastifyPluginAsyncTypebox = async (app) => {
    // Only platform admins can manage API keys
    app.addHook('preHandler', async (request, reply) => {
        if (request.principal.type !== PrincipalType.USER) {
            return reply.code(403).send({ error: 'Only users can manage API keys' })
        }
        
        const user = await userService.getOneOrFail({ id: request.principal.id })
        const platform = await platformService.getOneOrThrow(request.principal.platform.id)
        
        // Check if user is the platform owner
        if (platform.ownerId !== user.id) {
            return reply.code(403).send({ error: 'Only platform owner can manage API keys' })
        }
    })
    
    await app.register(ceApiKeyController, { prefix: '/v1/api-keys' })
}

const ceApiKeyController: FastifyPluginAsyncTypebox = async (app) => {
    // POST /v1/api-keys - Create a new API key
    app.post('/', {
        config: {
            allowedPrincipals: [PrincipalType.USER] as const,
        },
        schema: {
            tags: ['api-keys'],
            body: Type.Object({
                displayName: Type.String({ minLength: 1 }),
            }),
            response: {
                [StatusCodes.CREATED]: Type.Object({
                    id: Type.String(),
                    displayName: Type.String(),
                    truncatedValue: Type.String(),
                    value: Type.String(),
                    created: Type.String(),
                }),
            },
        },
    }, async (request, reply) => {
        const platformId = request.principal.platform.id
        assertNotNullOrUndefined(platformId, 'platformId')
        
        const newApiKey = await ceApiKeyService.add({
            platformId,
            displayName: request.body.displayName,
        })
        
        return reply.status(StatusCodes.CREATED).send({
            id: newApiKey.id,
            displayName: newApiKey.displayName,
            truncatedValue: newApiKey.truncatedValue,
            value: newApiKey.value,
            created: newApiKey.created,
        })
    })
    
    // GET /v1/api-keys - List API keys
    app.get('/', {
        config: {
            allowedPrincipals: [PrincipalType.USER] as const,
        },
        schema: {
            tags: ['api-keys'],
            response: {
                [StatusCodes.OK]: Type.Object({
                    data: Type.Array(Type.Object({
                        id: Type.String(),
                        displayName: Type.String(),
                        truncatedValue: Type.String(),
                        created: Type.String(),
                        lastUsedAt: Type.Optional(Type.String()),
                    })),
                }),
            },
        },
    }, async (request) => {
        const platformId = request.principal.platform.id
        assertNotNullOrUndefined(platformId, 'platformId')
        
        const apiKeys = await ceApiKeyService.list({ platformId })
        
        return {
            data: apiKeys.map(key => ({
                id: key.id,
                displayName: key.displayName,
                truncatedValue: key.truncatedValue,
                created: key.created,
                lastUsedAt: key.lastUsedAt,
            })),
        }
    })
    
    // DELETE /v1/api-keys/:id - Delete an API key
    app.delete('/:id', {
        config: {
            allowedPrincipals: [PrincipalType.USER] as const,
        },
        schema: {
            tags: ['api-keys'],
            params: Type.Object({
                id: ApId,
            }),
        },
    }, async (request, reply) => {
        const platformId = request.principal.platform.id
        assertNotNullOrUndefined(platformId, 'platformId')
        
        await ceApiKeyService.delete({
            platformId,
            id: request.params.id,
        })
        
        return reply.status(StatusCodes.OK).send()
    })
}
