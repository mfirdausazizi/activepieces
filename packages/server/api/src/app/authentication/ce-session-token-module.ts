/**
 * Community Edition Session Token Module
 * 
 * Registers the CE session token controller for external authentication.
 */

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { ceSessionTokenController } from './ce-session-token-controller'

export const ceSessionTokenModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(ceSessionTokenController, { prefix: '/v1/authn' })
}
