/**
 * External Project Module
 * 
 * Registers the external project controller for Community Edition
 * to support external integrations like OruCRM.
 */

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { externalProjectController } from './external-project-controller'

export const externalProjectModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(externalProjectController, { prefix: '/v1/projects' })
}
