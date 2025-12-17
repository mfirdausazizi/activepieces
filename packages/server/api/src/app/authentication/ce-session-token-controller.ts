/**
 * Community Edition Session Token Controller
 * 
 * Provides an endpoint to generate session tokens for external integrations.
 * This allows OruCRM users to be automatically logged into ActivePieces
 * without requiring manual sign-in.
 * 
 * Endpoint:
 * - POST /v1/authn/external-token - Generate a session token for a project
 */

import {
    ActivepiecesError,
    EndpointScope,
    ErrorCode,
    isNil,
    PrincipalType,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import dayjs from 'dayjs'
import { accessTokenManager } from './lib/access-token-manager'
import { projectService } from '../project/project-service'
import { userService } from '../user/user-service'
import { userIdentityService } from './user-identity/user-identity-service'
import { system } from '../helper/system/system'

export const ceSessionTokenController: FastifyPluginAsyncTypebox = async (app) => {
    
    // POST /v1/authn/external-token - Generate session token for a project
    app.post('/external-token', GenerateTokenRequest, async (request, reply) => {
        const platformId = request.principal.platform.id
        const { externalProjectId } = request.body
        
        // Find project by externalId
        const project = await projectService.getByPlatformIdAndExternalId({
            platformId,
            externalId: externalProjectId,
        })
        
        if (isNil(project)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'project',
                    entityId: externalProjectId,
                    message: `Project with externalId "${externalProjectId}" not found`,
                },
            })
        }
        
        // Get project owner
        const user = await userService.get({ id: project.ownerId })
        
        if (isNil(user)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    entityType: 'user',
                    entityId: project.ownerId,
                    message: 'Project owner not found',
                },
            })
        }
        
        // Get user identity to get tokenVersion
        const identity = await userIdentityService(system.globalLogger()).getOneOrFail({
            id: user.identityId,
        })
        
        // Generate a short-lived token (5 minutes) for URL-based auth
        // The user will exchange this for a full session on the frontend
        const expiresInSeconds = 5 * 60 // 5 minutes
        
        const token = await accessTokenManager.generateToken({
            id: user.id,
            type: PrincipalType.USER,
            projectId: project.id,
            platform: {
                id: platformId,
            },
            tokenVersion: identity.tokenVersion,
        }, expiresInSeconds)
        
        const expiresAt = dayjs().add(expiresInSeconds, 'second').toISOString()
        
        return reply.status(StatusCodes.OK).send({
            token,
            projectId: project.id,
            expiresAt,
        })
    })
}

const GenerateTokenRequest = {
    config: {
        allowedPrincipals: [PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['authentication'],
        description: 'Generate a session token for external project authentication',
        body: Type.Object({
            externalProjectId: Type.String({
                description: 'The external project ID (e.g., orucrm_orgId)',
            }),
        }),
        response: {
            [StatusCodes.OK]: Type.Object({
                token: Type.String({
                    description: 'JWT session token for authentication',
                }),
                projectId: Type.String({
                    description: 'The internal ActivePieces project ID',
                }),
                expiresAt: Type.String({
                    description: 'ISO timestamp when the token expires',
                }),
            }),
        },
    },
}
