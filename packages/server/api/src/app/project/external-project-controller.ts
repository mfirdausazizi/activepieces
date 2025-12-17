/**
 * External Project Controller for OruCRM Integration
 * 
 * This controller provides simplified project management endpoints
 * for external integrations in Community Edition.
 * 
 * Endpoints:
 * - POST /v1/projects - Create a new project
 * - GET /v1/projects - List projects (with optional externalId filter)
 * - GET /v1/projects/:id - Get project by ID
 */

import {
    EndpointScope,
    isNil,
    PrincipalType,
    Project,
    ProjectType,
    SeekPage,
} from '@activepieces/shared'
import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox'
import { StatusCodes } from 'http-status-codes'
import { paginationHelper } from '../helper/pagination/pagination-utils'
import { platformService } from '../platform/platform.service'
import { projectRepo, projectService } from './project-service'

export const externalProjectController: FastifyPluginAsyncTypebox = async (app) => {
    
    // POST /v1/projects - Create a new project
    app.post('/', CreateProjectRequest, async (request, reply) => {
        const platformId = request.principal.platform.id
        
        // Get platform owner to use as project owner
        const platform = await platformService.getOneOrThrow(platformId)
        
        // Check if project with same externalId already exists
        if (request.body.externalId) {
            const existing = await projectService.getByPlatformIdAndExternalId({
                platformId,
                externalId: request.body.externalId,
            })
            if (existing) {
                // Return existing project instead of creating duplicate
                return reply.status(StatusCodes.OK).send(existing)
            }
        }
        
        const project = await projectService.create({
            ownerId: platform.ownerId,
            displayName: request.body.displayName,
            platformId,
            externalId: request.body.externalId ?? undefined,
            type: ProjectType.TEAM,
        })
        
        return reply.status(StatusCodes.CREATED).send(project)
    })
    
    // GET /v1/projects - List projects
    app.get('/', ListProjectsRequest, async (request) => {
        const platformId = request.principal.platform.id
        
        // If externalId is provided, filter by it
        if (request.query.externalId) {
            const project = await projectService.getByPlatformIdAndExternalId({
                platformId,
                externalId: request.query.externalId,
            })
            if (project) {
                return paginationHelper.createPage([project], null)
            }
            return paginationHelper.createPage([], null)
        }
        
        // Otherwise return all projects for the platform
        const projects = await projectRepo().find({
            where: { platformId },
            order: { created: 'DESC' },
            take: request.query.limit ?? 50,
        })
        
        return paginationHelper.createPage(projects, null)
    })
    
    // GET /v1/projects/:id - Get project by ID
    app.get('/:id', GetProjectRequest, async (request) => {
        const project = await projectService.getOneOrThrow(request.params.id)
        
        // Verify project belongs to the same platform
        if (project.platformId !== request.principal.platform.id) {
            return { error: 'Project not found' }
        }
        
        return project
    })
}

const CreateProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        description: 'Create a new project',
        body: Type.Object({
            displayName: Type.String({ minLength: 1 }),
            externalId: Type.Optional(Type.String()),
        }),
        response: {
            [StatusCodes.CREATED]: Project,
            [StatusCodes.OK]: Project,
        },
    },
}

const ListProjectsRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        description: 'List projects',
        querystring: Type.Object({
            externalId: Type.Optional(Type.String()),
            limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        }),
        response: {
            [StatusCodes.OK]: SeekPage(Project),
        },
    },
}

const GetProjectRequest = {
    config: {
        allowedPrincipals: [PrincipalType.USER, PrincipalType.SERVICE] as const,
        scope: EndpointScope.PLATFORM,
    },
    schema: {
        tags: ['projects'],
        description: 'Get project by ID',
        params: Type.Object({
            id: Type.String(),
        }),
        response: {
            [StatusCodes.OK]: Project,
        },
    },
}
