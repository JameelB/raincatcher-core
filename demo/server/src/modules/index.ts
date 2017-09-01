import { SyncExpressMiddleware, userMapperMiddleware } from '@raincatcher/datasync-cloud';
import SyncServer, { SyncApi, SyncOptions } from '@raincatcher/datasync-cloud';
import { EndpointSecurity } from '@raincatcher/express-auth';
import { getLogger } from '@raincatcher/logger';
import initData from '@raincatcher/wfm-demo-data';
import { WfmRestApi } from '@raincatcher/wfm-rest-api';
import { User, UserController, UsersRepository } from '@raincatcher/wfm-user';
import * as Promise from 'bluebird';
import * as express from 'express';
import { SessionOptions } from 'express-session';
import { Db } from 'mongodb';
import appConfig from '../util/Config';
import { connect as syncConnector } from './datasync/Connector';
import { init as initKeycloak } from './keycloak';
import { init as authInit } from './passport-auth';
import sessionOpts from './SessionOptions';
import {StaticUsersRepository} from './wfm-user/StaticUsersRepository';

const config = appConfig.getConfig();

export let portalsecurityMiddleware: EndpointSecurity;
export let mobileSecurityMiddleware: EndpointSecurity;

// Setup all modules
export function setupModules(app: express.Express) {
  const mobileApp = express.Router();
  const portalApp = express.Router();
  portalsecurityMiddleware = securitySetup(portalApp, sessionOpts);
  mobileSecurityMiddleware = securitySetup(mobileApp);
  const connectionPromise = syncSetup(mobileApp);
  wfmApiSetup(portalApp, connectionPromise);
  userApiSetup(portalApp);
  demoDataSetup(connectionPromise);
  app.use(portalApp);
  app.use(mobileApp);
}

function securitySetup(app: express.Router, sessionOptions?: SessionOptions) {
  // Use Keycloak if Keycloak configuration is provided
  const useKeycloak = config.keycloakConfig || false;
  if (useKeycloak) {
    // user keycloak authentication
    return setupKeycloakSecurity(app);
  } else {
    // resort to passport authentication
    return setupPassportSecurity(app, sessionOptions);
  }
}

function userApiSetup(app: express.Router) {
  const usersRepo = new StaticUsersRepository();
  const userController = new UserController(usersRepo);
  const role = config.security.adminRole;
  app.use('/api/users', portalsecurityMiddleware.protect(role), userController.buildRouter());
}

function setupPassportSecurity(app: express.Router, sessionOptions?: SessionOptions) {
 return authInit(app, sessionOptions);
}

function setupKeycloakSecurity(app: express.Router) {
  return  initKeycloak(app);
}

function syncSetup(app: express.Router) {
  // Mount api
  const role = config.security.userRole;
  // Mount router at specific location
  const middleware: SyncExpressMiddleware = new SyncExpressMiddleware('');
  const syncRouter = middleware.createSyncExpressRouter();

  app.use('/sync', mobileSecurityMiddleware.protect(role));
  app.use('/sync', userMapperMiddleware('workorders', 'assignee', true));
  app.use('/sync', syncRouter);

  return syncConnector().then(function(connections: { mongo: Db, redis: any }) {
    getLogger().info('Sync started');
    return connections.mongo;
  }).catch(function(err: any) {
    getLogger().error('Failed to initialize sync', err);
  });
}

function wfmApiSetup(app: express.Router, connectionPromise: Promise<any>) {
  // Mount api
  const api = new WfmRestApi();
  const role = config.security.adminRole;
  app.use('/api', portalsecurityMiddleware.protect(role));
  app.use('/api', api.createWFMRouter());
  connectionPromise.then(function(mongo: Db) {
    // Fix compilation problem with different version of Db.
    api.setDb(mongo as any);
  });
}

function demoDataSetup(connectionPromise: Promise<Db>) {
  connectionPromise.then(function(mongo: Db) {
    if (config.seedDemoData) {
      initData(mongo);
    }
  });
}
