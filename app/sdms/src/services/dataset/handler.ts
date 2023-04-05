// ============================================================================
// Copyright 2017-2021, Schlumberger
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ============================================================================

import { Request as expRequest, Response as expResponse } from 'express';

import { DatasetModel, DatasetUtils } from '.';
import { Auth, AuthRoles } from '../../auth';
import { Config, JournalFactoryTenantClient, LoggerFactory, StorageFactory } from '../../cloud';
import { SeistoreFactory } from '../../cloud/seistore';
import { DESStorage, DESUtils, UserAssociationServiceFactory } from '../../dataecosystem';
import { Error, ErrorModel, Feature, FeatureFlags, Response, Utils } from '../../shared';
import { SubprojectAuth, SubProjectDAO, SubProjectModel } from '../subproject';
import { TenantDAO, TenantModel } from '../tenant';
import { DatasetAuth } from './auth';
import { DatasetDAO } from './dao';
import { IWriteLockSession, Locker } from './locker';
import { DatasetOP } from './optype';
import { DatasetParser } from './parser';
import { SchemaManagerFactory } from './schema-manager';

export class DatasetHandler {

    // handler for the [ /dataset ] endpoints
    public static async handler(req: expRequest, res: expResponse, op: DatasetOP) {

        try {
            const tenant = await TenantDAO.get(req.params.tenantid);
            const subproject = await SubProjectDAO.get(
                JournalFactoryTenantClient.get(tenant), req.params.tenantid, req.params.subprojectid);

            if (op === DatasetOP.CheckCTag) {
                Response.writeOK(res, await this.checkCTag(req, subproject));
            } else if (op === DatasetOP.Register) {
                Response.writeOK(res, await this.register(req, tenant, subproject));
            } else if (op === DatasetOP.Get) {
                Response.writeOK(res, await this.get(req, tenant, subproject));
            } else if (op === DatasetOP.List) {
                Response.writeOK(res, await this.list(req, tenant, subproject));
            } else if (op === DatasetOP.Delete) {
                Response.writeOK(res, await this.delete(req, tenant, subproject));
            } else if (op === DatasetOP.Patch) {
                Response.writeOK(res, await this.patch(req, tenant, subproject));
            } else if (op === DatasetOP.Lock) {
                Response.writeOK(res, await this.lock(req, tenant, subproject));
            } else if (op === DatasetOP.UnLock) {
                Response.writeOK(res, await this.unlock(req, tenant, subproject));
            } else if (op === DatasetOP.Exists) {
                Response.writeOK(res, await this.exists(req, tenant, subproject));
            } else if (op === DatasetOP.Sizes) {
                Response.writeOK(res, await this.sizes(req, tenant, subproject));
            } else if (op === DatasetOP.ComputeSize) {
                Response.writeOK(res, await this.computeSize(req, tenant, subproject));
            } else if (op === DatasetOP.Permission) {
                Response.writeOK(res, await this.checkPermissions(req, tenant, subproject));
            } else if (op === DatasetOP.ListContent) {
                Response.writeOK(res, await this.listContent(req, tenant, subproject));
            } else if (op === DatasetOP.PutTags) {
                Response.writeOK(res, await this.putTags(req, tenant, subproject));
            } else { throw (Error.make(Error.Status.UNKNOWN, 'Internal Server Error')); }

        } catch (error) {
            Response.writeError(res, error);
        }

    }

    // Validate the dataset coherency tag
    // Required role: any
    private static async checkCTag(req: expRequest, subproject: SubProjectModel): Promise<boolean> {

        // parse user request
        const userInput = DatasetParser.checkCTag(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get({
            gcpid: userInput.tenantID, esd: userInput.dataPartitionID, default_acls: 'any', name: userInput.tenantID
        });

        const datasetOUT = subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, userInput.dataset) :
            (await DatasetDAO.get(journalClient, userInput.dataset))[0];

        // check if the dataset does not exist
        if (!datasetOUT) {
            throw (Error.make(Error.Status.NOT_FOUND, 'The dataset ' +
                Config.SDPATHPREFIX + userInput.dataset.tenant + '/' +
                userInput.dataset.subproject + userInput.dataset.path +
                userInput.dataset.name + ' does not exist'));
        }

        // return the cTag check validation
        return datasetOUT.ctag === userInput.dataset.ctag;
    }

    // Register a new dataset in the subproject data group
    // Required role: subproject.admin
    private static async register(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // consistency flag
        let datasetRegisteredConsistencyFlag = false;
        let datasetEntityKey: object;

        // parse the user input and create the dataset metadata model
        const dataset = await DatasetParser.register(req);
        let writeLockSession: IWriteLockSession;

        const journalClient = JournalFactoryTenantClient.get(tenant);

        try {

            if (dataset.acls && subproject.access_policy === Config.UNIFORM_ACCESS_POLICY) {
                throw Error.make(Error.Status.BAD_REQUEST,
                    'Subproject access policy is set to uniform and so ACLs cannot be applied.');
            }

            // attempt to acquire a mutex on the dataset name and set the lock for the dataset in redis
            // a mutex is applied on the resource on the shared cache (removed at the end of the method)
            const datasetLockKey = dataset.tenant + '/' + dataset.subproject + dataset.path + dataset.name;
            writeLockSession = await Locker.createWriteLock(
                datasetLockKey, req.headers['x-seismic-dms-lockid'] as string);

            // if the call is idempotent return the dataset value
            if (writeLockSession.idempotent) {
                const alreadyRegisteredDataset = subproject.enforce_key ?
                    await DatasetDAO.getByKey(journalClient, dataset) :
                    (await DatasetDAO.get(journalClient, dataset))[0];
                if (alreadyRegisteredDataset) {
                    await Locker.removeWriteLock(writeLockSession, true); // Keep the lock session
                    return alreadyRegisteredDataset;
                }
            }

            // ensure that a legal tag exist
            dataset.ltag = dataset.ltag || subproject.ltag;
            if (!dataset.ltag) {
                throw Error.make(Error.Status.NOT_FOUND,
                    'No legal-tag has been found for the subproject resource ' +
                    Config.SDPATHPREFIX + dataset.tenant + '/' + dataset.subproject +
                    ' the storage metadata cannot be updated without a valid a legal-tag');
            }

            // check if has read access, if legal tag is valid, and if the dataset does not already exist
            await Promise.all([

                Auth.isWriteAuthorized(req.headers.authorization,
                    SubprojectAuth.getAuthGroups(subproject, AuthRoles.admin),
                    tenant, dataset.subproject, req[Config.DE_FORWARD_APPKEY],
                    req.headers['impersonation-token-context'] as string),

                dataset.ltag ? Auth.isLegalTagValid(
                    req.headers.authorization, dataset.ltag,
                    tenant.esd, req[Config.DE_FORWARD_APPKEY]) : undefined,
            ]);

            Config.disableStrongConsistencyEmulation();
            const datasetAlreadyExist = subproject.enforce_key ?
                await DatasetDAO.getByKey(journalClient, dataset) :
                (await DatasetDAO.get(journalClient, dataset))[0];
            Config.enableStrongConsistencyEmulation();

            // check if dataset already exist
            if (datasetAlreadyExist) {
                throw (Error.make(Error.Status.ALREADY_EXISTS,
                    'The dataset ' + Config.SDPATHPREFIX + dataset.tenant + '/' +
                    dataset.subproject + dataset.path + dataset.name +
                    ' already exists'));
            }

            if (dataset.storageSchemaRecordType) {
                SchemaManagerFactory
                    .build(dataset.storageSchemaRecordType)
                    .addStorageRecordDefaults(dataset.storageSchemaRecord, dataset, tenant);
            }

            // get the gcs account from the cloud provider
            dataset.gcsurl = await SeistoreFactory.build(
                Config.CLOUDPROVIDER).getDatasetStorageResource(tenant, subproject);

            // prepare the keys
            datasetEntityKey = journalClient.createKey({
                namespace: Config.SEISMIC_STORE_NS + '-' + dataset.tenant + '-' + dataset.subproject,
                path: [Config.DATASETS_KIND],
                enforcedKey: subproject.enforce_key ? (dataset.path.slice(0, -1) + '/' + dataset.name) : undefined
            });

            // if the registration does not succeed because an error is thrown from the DB, storage svc or the locker,
            // this flag will inform the service to check roll-back the registration in the error catch.
            datasetRegisteredConsistencyFlag = true;

            // StorageSchemaRecord is not persisted in the dataset metadata
            const storageSchemaRecord = dataset.storageSchemaRecord;
            delete dataset.storageSchemaRecord;

            // save the dataset entity
            await Promise.all([
                DatasetDAO.register(journalClient, { key: datasetEntityKey, data: dataset }),
                (storageSchemaRecord && (FeatureFlags.isEnabled(Feature.SEISMICMETA_STORAGE))) ?
                    DESStorage.insertRecord(req.headers.authorization,
                        [storageSchemaRecord], tenant.esd, req[Config.DE_FORWARD_APPKEY]) : undefined,
            ]);

            // release the mutex and keep the lock session
            await Locker.removeWriteLock(writeLockSession, true);

            // attach the gcpid for fast check
            dataset.ctag = dataset.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);

            // attach access policy
            dataset.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

            // attach locking information
            dataset.sbit = writeLockSession.wid;
            dataset.sbit_count = 1;

            if (storageSchemaRecord) {
                delete dataset.storageSchemaRecordType;
            }

            return dataset;

        } catch (err) {

            // rollback
            if (datasetRegisteredConsistencyFlag) {
                const datasetCheck = subproject.enforce_key ?
                    await DatasetDAO.getByKey(journalClient, dataset) :
                    (await DatasetDAO.get(journalClient, dataset))[0];
                if (datasetCheck) {
                    await DatasetDAO.delete(journalClient, datasetCheck);
                    if (datasetCheck.seismicmeta_guid) {
                        await DESStorage.deleteRecord(
                            req.headers.authorization, datasetCheck.last_modified_date,
                            tenant.esd, req[Config.DE_FORWARD_APPKEY]);
                    }
                }
            }

            // release the mutex and unlock the resource
            await Locker.removeWriteLock(writeLockSession);

            // if the error was a 423, the previous line cleaned the status of locker cache.
            // it is no more required to throw a 423 error or consumer applications can wrongly retry the call
            // by trying to unlock a non locked status
            if (err instanceof (ErrorModel)) {
                if ((err as ErrorModel).error.code === Error.Status.LOCKED) {
                    throw (Error.make(Error.Status.UNKNOWN, ' correctly handled previously thrown error ' +
                        (err as ErrorModel).error.status + ':' + (err as ErrorModel).error.message +
                        ' an idempotent retry is required'));
                }
            }

            throw (err);

        }

    }

    // Retrieve the dataset metadata
    // Required role: subproject.viewer || dataset.viewer (dependents on applied access policy)
    private static async get(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // parse user request
        const userInput = DatasetParser.get(req);
        const datasetIN = userInput[0];
        const convertUserInfo = userInput[2];
        const seismicMetaRecordVersion = userInput[3];

        // retrieve journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Retrieve the dataset metadata
        const datasetOUT = subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, datasetIN) :
            (await DatasetDAO.get(journalClient, datasetIN))[0];

        // check if the dataset does not exist
        if (!datasetOUT) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
        }

        // Check if retrieve the seismic metadata storage record
        const retrieveStorageRecord = datasetOUT.seismicmeta_guid !== undefined && userInput[1];

        // Check if legal tag is valid
        if (datasetOUT.ltag) {
            await Auth.isLegalTagValid(req.headers.authorization, datasetOUT.ltag,
                tenant.esd, req[Config.DE_FORWARD_APPKEY]);
        }

        // Use the access policy to determine which groups to fetch for read authorization
        await Auth.isReadAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, datasetOUT, AuthRoles.viewer),
            tenant, datasetIN.subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);

        // [NOTE OF DEPRECATION] subid-to-email to deprecated in favor of translate-user-info
        // Convert userId to email if translate-user-info or subid-to-email is not false
        if (FeatureFlags.isEnabled(Feature.CCM_INTERACTION) && convertUserInfo) {
            if (!Utils.isEmail(datasetOUT.created_by)) {
                const dataPartition = DESUtils.getDataPartitionID(tenant.esd);
                const userEmail = await UserAssociationServiceFactory.build(
                    Config.USER_ASSOCIATION_SVC_PROVIDER).convertPrincipalIdentifierToUserInfo(
                        datasetOUT.created_by, dataPartition);
                datasetOUT.created_by = userEmail;
            }
        }

        // Apply transforms for openzgy_V1 and segy_v1 is required
        if (retrieveStorageRecord) {
            let recordExist = true;
            const storageSchemaRecord = await DESStorage.getRecord(req.headers.authorization,
                datasetOUT.seismicmeta_guid,
                tenant.esd,
                req[Config.DE_FORWARD_APPKEY],
                seismicMetaRecordVersion).catch((error) => {
                    recordExist = false;
                });

            if(recordExist){
                // For all datasets with storage record, the default storage schema type is seismicmeta
                if (storageSchemaRecord && !datasetOUT.storageSchemaRecordType) {
                    datasetOUT.storageSchemaRecordType = 'seismicmeta';
                }

                SchemaManagerFactory.build(datasetOUT.storageSchemaRecordType).applySchemaTransforms({
                    data: storageSchemaRecord,
                    transformFuncID: storageSchemaRecord['kind'],
                    nextTransformFuncID: undefined
                });

                (datasetOUT as any)[datasetOUT.storageSchemaRecordType] = storageSchemaRecord;
                delete datasetOUT.storageSchemaRecordType;
            }
        }
        // attach the gcpid for fast check
        datasetOUT.ctag = datasetOUT.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);

        // attach access policy
        datasetOUT.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

        return datasetOUT;

    }

    // List the datasets in a subproject
    // Required role: subproject.viewer
    private static async list(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const userInput = DatasetParser.list(req);

        const dataset = userInput.dataset;
        const pagination = userInput.pagination;
        const userInfo = userInput.userInfo;

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Check authorizations
        await Auth.isReadAuthorized(req.headers.authorization,
            SubprojectAuth.getAuthGroups(subproject, AuthRoles.viewer),
            tenant, dataset.subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);

        // Retrieve the list of datasets metadata
        const output = await DatasetDAO.list(journalClient, dataset, pagination) as any;

        // attach the gcpid for fast check, access_policy and exchange user-info (if requested)
        const userAssociationService = FeatureFlags.isEnabled(Feature.CCM_INTERACTION) && userInfo ?
            UserAssociationServiceFactory.build(Config.USER_ASSOCIATION_SVC_PROVIDER) : undefined;
        const dataPartition = DESUtils.getDataPartitionID(tenant.esd);
        for (const item of output.datasets) {
            item.ctag = item.ctag + tenant.gcpid + ';' + dataPartition;
            item.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;
            if (userAssociationService && !Utils.isEmail(item.created_by)) {
                item.created_by = await userAssociationService.convertPrincipalIdentifierToUserInfo(
                    item.created_by, dataPartition);
            }
        }

        // Retrieve the list of datasets metadata
        if (pagination) {
            return output;
        }

        return output.datasets;
    }

    // Delete a dataset from a subproject data group
    // Required role: subproject.admin || dataset.admin (dependents on applied access policy)
    private static async delete(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const datasetIn = DatasetParser.delete(req);
        const lockKey = datasetIn.tenant + '/' + datasetIn.subproject + datasetIn.path + datasetIn.name;

        // ensure is not write locked
        if (!Config.SKIP_WRITE_LOCK_CHECK_ON_MUTABLE_OPERATIONS) {
            if (Locker.isWriteLock(await Locker.getLock(lockKey))) {
                throw (Error.make(Error.Status.LOCKED,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIn.tenant + '/' +
                    datasetIn.subproject + datasetIn.path + datasetIn.name + ' is write locked ' +
                    Error.get423WriteLockReason()));
            }
        }

        // init datastore client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Retrieve the dataset metadata
        const dataset = subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, datasetIn) :
            (await DatasetDAO.get(journalClient, datasetIn))[0];

        // if the dataset does not exist return ok
        if (!dataset) { return; }

        // check authorization (write)
        await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.admin),
            tenant, subproject.name, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        // Delete the dataset metadata on DEStorage
        await DatasetDAO.delete(journalClient, dataset);

        // Delete all physical objects (not wait for full objects deletion)
        const bucket = DatasetUtils.getBucketFromDatasetResourceUri(dataset.gcsurl);
        const virtualFolder = DatasetUtils.getVirtualFolderFromDatasetResourceUri(dataset.gcsurl);
        StorageFactory.build(Config.CLOUDPROVIDER, tenant).deleteObjects(
            bucket, virtualFolder).catch((error) => {
                LoggerFactory.build(Config.CLOUDPROVIDER).error(JSON.stringify(error));
            });

        // remove any remaining locks (this should be removed with SKIP_WRITE_LOCK_CHECK_ON_MUTABLE_OPERATIONS)
        const datasetLockKey = dataset.tenant + '/' + dataset.subproject + dataset.path + dataset.name;
        await Locker.unlock(datasetLockKey);

    }

    // Patch the dataset metadata
    // Required role:
    //  - patch with a body request: subproject.admin || dataset.admin (dependents on applied access policy)
    //  - write close only request: subproject.admin || dataset.admin (dependents on applied access policy)
    //  - read close only request: subproject.viewer || dataset.viewer (dependents on applied access policy)
    private static async patch(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const [datasetIN, newName, wid] = DatasetParser.patch(req);
        const lockKey = datasetIN.tenant + '/' + datasetIN.subproject + datasetIN.path + datasetIN.name;

        // retrieve datastore client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // return immediately if it is a simple close with empty body (no patch to apply)
        if (Object.keys(req.body).length === 0 && req.body.constructor === Object && wid) {

            // Retrieve the dataset metadata
            const dataset = subproject.enforce_key ?
                await DatasetDAO.getByKey(journalClient, datasetIN) :
                (await DatasetDAO.get(journalClient, datasetIN))[0];

            // check if the dataset does not exist
            if (!dataset) {
                throw (Error.make(Error.Status.NOT_FOUND,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
            }

            // Check authorizations
            if (wid.startsWith('W')) {
                await Auth.isWriteAuthorized(req.headers.authorization,
                    DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.admin),
                    tenant, subproject.name, req[Config.DE_FORWARD_APPKEY],
                    req.headers['impersonation-token-context'] as string);
            } else {
                await Auth.isReadAuthorized(req.headers.authorization,
                    DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.viewer),
                    tenant, subproject.name, req[Config.DE_FORWARD_APPKEY],
                    req.headers['impersonation-token-context'] as string);
            }


            // unlock the dataset
            const unlockRes = await Locker.unlock(lockKey, wid);
            dataset.sbit = unlockRes.id;
            dataset.sbit_count = unlockRes.cnt;

            // attach the gcpid for fast check
            dataset.ctag = dataset.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);
            // attach access policy
            dataset.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

            return dataset;
        }

        // Ensure subproject access policy is not set to uniform
        if (datasetIN.acls) {
            const subprojectMetadata = await SubProjectDAO.get(journalClient, tenant.name, subproject.name);
            const subprojectAccessPolicy = subprojectMetadata.access_policy;

            if (subprojectAccessPolicy === Config.UNIFORM_ACCESS_POLICY) {
                throw Error.make(Error.Status.BAD_REQUEST,
                    'Subproject access policy is set to uniform and so the dataset ACLs cannot be applied. Patch the subproject access policy to dataset and attempt this operation again.');
            }
        }

        // unlock the dataset for close operation (and patch)
        const lockres = wid ? await Locker.unlock(lockKey, wid) : { id: null, cnt: 0 };

        // ensure nobody got the lock between the close and the mutex acquisition
        if (!Config.SKIP_WRITE_LOCK_CHECK_ON_MUTABLE_OPERATIONS) {
            if (Locker.isWriteLock(await Locker.getLock(lockKey))) {
                throw (Error.make(Error.Status.LOCKED,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + datasetIN.name + ' is write locked ' +
                    Error.get423WriteLockReason()));
            }
        }

        // Retrieve the dataset metadata
        let datasetOUT: DatasetModel;
        let datasetOUTKey: any;
        if (subproject.enforce_key) {
            datasetOUT = await DatasetDAO.getByKey(journalClient, datasetIN);
            datasetOUTKey = journalClient.createKey({
                namespace: Config.SEISMIC_STORE_NS + '-' + datasetIN.tenant + '-' + datasetIN.subproject,
                path: [Config.DATASETS_KIND],
                enforcedKey: datasetIN.path.slice(0, -1) + '/' + datasetIN.name
            });
        } else {
            const results = await DatasetDAO.get(journalClient, datasetIN);
            datasetOUT = results[0];
            datasetOUTKey = results[1];
        }

        // check if the dataset does not exist
        if (!datasetOUT) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
        }

        // If the input request has dataset ACLs then the subproject access policy is always dataset
        await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, datasetOUT, AuthRoles.admin),
            tenant, subproject.name, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        // patch datasetOUT with datasetIN
        if (datasetIN.metadata) { datasetOUT.metadata = datasetIN.metadata; }
        if (datasetIN.filemetadata) { datasetOUT.filemetadata = datasetIN.filemetadata; }
        if (datasetIN.last_modified_date) { datasetOUT.last_modified_date = datasetIN.last_modified_date; }
        if (datasetIN.readonly !== undefined) { datasetOUT.readonly = datasetIN.readonly; }
        if (datasetIN.gtags !== undefined && datasetIN.gtags.length > 0) { datasetOUT.gtags = datasetIN.gtags; }
        if (datasetIN.ltag) {
            await Auth.isLegalTagValid(
                req.headers.authorization, datasetIN.ltag, tenant.esd, req[Config.DE_FORWARD_APPKEY]);

            datasetOUT.ltag = datasetIN.ltag;
        }

        if (newName) {
            if (newName === datasetIN.name) {
                throw (Error.make(Error.Status.ALREADY_EXISTS,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + newName + ' already exists'));
            }

            datasetIN.name = newName;

            Config.disableStrongConsistencyEmulation();
            const datasetAlreadyExist = subproject.enforce_key ?
                await DatasetDAO.getByKey(journalClient, datasetIN) :
                (await DatasetDAO.get(journalClient, datasetIN))[0];
            Config.enableStrongConsistencyEmulation();

            // check if dataset already exist
            if (datasetAlreadyExist) {
                throw (Error.make(Error.Status.ALREADY_EXISTS,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + newName + ' already exists'));
            }

            if (subproject.enforce_key) {
                datasetOUTKey = journalClient.createKey({
                    namespace: Config.SEISMIC_STORE_NS + '-' + datasetIN.tenant + '-' + datasetIN.subproject,
                    path: [Config.DATASETS_KIND],
                    enforcedKey: datasetIN.path.slice(0, -1) + '/' + datasetIN.name
                });
            }

            datasetOUT.name = newName;
        }

        if (datasetIN.storageSchemaRecord) {

            SchemaManagerFactory.build(datasetIN.storageSchemaRecordType)
                .addStorageRecordDefaults(datasetIN.storageSchemaRecord, datasetOUT, tenant);

            SchemaManagerFactory.build(datasetIN.storageSchemaRecordType)
                .applySchemaTransforms({
                    data: datasetIN.storageSchemaRecord,
                    transformFuncID: datasetIN.storageSchemaRecord['kind'],
                    nextTransformFuncID: undefined
                });

            datasetOUT.storageSchemaRecordType = datasetIN.storageSchemaRecordType;

        }

        // Update the ACLs if the input request has them
        if (datasetIN.acls) {
            datasetOUT.acls = datasetIN.acls;
        }

        if (datasetIN.storageSchemaRecord && (FeatureFlags.isEnabled(Feature.SEISMICMETA_STORAGE))) {
            await DESStorage.insertRecord(
                req.headers.authorization, [datasetIN.storageSchemaRecord], tenant.esd, req[Config.DE_FORWARD_APPKEY]);
        }

        if (newName) {
            await Promise.all([
                DatasetDAO.delete(journalClient, datasetOUT),
                DatasetDAO.register(journalClient, { key: datasetOUTKey, data: datasetOUT })]);
        } else {
            await DatasetDAO.update(journalClient, datasetOUT, datasetOUTKey);
        }


        // attach lock information
        if (wid) {
            datasetOUT.sbit = lockres.id;
            datasetOUT.sbit_count = lockres.cnt;
        } else {
            const datasetOUTLockKey = datasetOUT.tenant + '/' + datasetOUT.subproject
                + datasetOUT.path + datasetOUT.name;
            const datasetOUTLockRes = await Locker.getLock(datasetOUTLockKey);
            if (datasetOUTLockRes) {
                if (Locker.isWriteLock(datasetOUTLockRes)) {
                    datasetOUT.sbit = datasetOUTLockRes as string;
                    datasetOUT.sbit_count = 1;
                } else {
                    datasetOUT.sbit = (datasetOUTLockRes as string[]).join(':');
                    datasetOUT.sbit_count = datasetOUTLockRes.length;
                }
            }
        }

        // attach the gcpid for fast check
        datasetOUT.ctag = datasetOUT.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);
        // attach access policy
        datasetOUT.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

        delete datasetOUT.storageSchemaRecordType;

        return datasetOUT;

    }

    // Lock the dataset
    // Required role:
    //  - write lock request: subproject.admin || dataset.admin (dependents on applied access policy)
    //  - read lock request: subproject.viewer || dataset.viewer (dependents on applied access policy)
    private static async lock(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // parse user request
        const userInput = DatasetParser.lock(req);
        const datasetIN = userInput.dataset;
        const open4write = userInput.open4write;
        const wid = userInput.wid;

        // retrieve datastore client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Retrieve the dataset metadata
        const datasetOUT = subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, datasetIN) :
            (await DatasetDAO.get(journalClient, datasetIN))[0];

        // check if the dataset does not exist
        if (!datasetOUT) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
        }

        // Check if legal tag is valid;
        if (datasetOUT.ltag) {
            await Auth.isLegalTagValid(req.headers.authorization, datasetOUT.ltag,
                tenant.esd, req[Config.DE_FORWARD_APPKEY]);
        }

        // Use the access policy to determine which groups to fetch for read authorization
        if (open4write) {
            await Auth.isWriteAuthorized(req.headers.authorization,
                DatasetAuth.getAuthGroups(subproject, datasetOUT, AuthRoles.admin),
                tenant, datasetIN.subproject, req[Config.DE_FORWARD_APPKEY],
                req.headers['impersonation-token-context'] as string);
        } else {
            await Auth.isReadAuthorized(req.headers.authorization,
                DatasetAuth.getAuthGroups(subproject, datasetOUT, AuthRoles.viewer),
                tenant, datasetIN.subproject, req[Config.DE_FORWARD_APPKEY],
                req.headers['impersonation-token-context'] as string);
        }


        // managing read-only datasets
        if (datasetOUT.readonly) {
            if (open4write) {
                throw (Error.make(Error.Status.BAD_REQUEST,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + datasetIN.name +
                    ' cannot be locked (read-only dataset)'));
            } else {
                // attach the gcpid for fast check
                datasetOUT.ctag = datasetOUT.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);
                // attach access policy
                datasetOUT.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;
                return datasetOUT;
            }
        }

        // lock in cache
        const lockKey = datasetIN.tenant + '/' + datasetIN.subproject + datasetIN.path + datasetIN.name;
        const lockres = open4write ?
            await Locker.acquireWriteLock(lockKey, req.headers['x-seismic-dms-lockid'] as string, wid) :
            await Locker.acquireReadLock(lockKey, req.headers['x-seismic-dms-lockid'] as string, wid);

        // attach lock information
        datasetOUT.sbit = lockres.id;
        datasetOUT.sbit_count = lockres.cnt;

        // attach the gcpid for fast check
        datasetOUT.ctag = datasetOUT.ctag + tenant.gcpid + ';' + DESUtils.getDataPartitionID(tenant.esd);
        // attach access policy
        datasetOUT.access_policy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

        return datasetOUT;

    }

    // Unlock the dataset
    // Required role: subproject.admin || dataset.admin (dependents on applied access policy)
    private static async unlock(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // parse user request
        const datasetIN = DatasetParser.unlock(req);

        // retrieve datastore client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Retrieve the dataset metadata
        const dataset = subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, datasetIN) :
            (await DatasetDAO.get(journalClient, datasetIN))[0];


        // check if the dataset does not exist
        const lockKey = datasetIN.tenant + '/' + datasetIN.subproject + datasetIN.path + datasetIN.name;
        if (!dataset) {
            if (await Locker.getLock(lockKey)) {
                // if a previous call fails, the dataset is not created but the lock is acquired and not released
                await Locker.unlock(lockKey);
                return;
            } else { // the dataset does not exist and is not locked
                throw (Error.make(Error.Status.NOT_FOUND,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
            }
        }

        // check if the user is authorized
        await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.admin),
            tenant, dataset.subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);

        // unlock
        await Locker.unlock(lockKey);

    }

    // Check if a list of datasets exist in a subproject
    // Required role: subproject.viewer
    private static async exists(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const datasets = DatasetParser.exists(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // check if the caller is authorized
        await Auth.isReadAuthorized(req.headers.authorization,
            SubprojectAuth.getAuthGroups(subproject, AuthRoles.viewer),
            tenant, datasets[0].subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        // Check if the required datasets exist
        Config.disableStrongConsistencyEmulation();
        const results: boolean[] = [];
        if (subproject.enforce_key) {
            for (const dataset of datasets) {
                results.push((await DatasetDAO.getByKey(journalClient, dataset)) !== undefined);
            }
        } else {
            for (const dataset of datasets) {
                results.push((await DatasetDAO.get(journalClient, dataset))[0] !== undefined);
            }
        }
        Config.enableStrongConsistencyEmulation();

        return results;
    }

    // Retrieve the dataset size for a list of datasets
    // Required role: subproject.viewer
    private static async sizes(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const datasets = DatasetParser.sizes(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // check if the caller is authorized
        await Auth.isReadAuthorized(req.headers.authorization,
            SubprojectAuth.getAuthGroups(subproject, AuthRoles.viewer),
            tenant, datasets[0].subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        // Check if the required datasets exist
        Config.disableStrongConsistencyEmulation();
        const results: number[] = [];
        if (subproject.enforce_key) {
            for (let dataset of datasets) {
                dataset = await DatasetDAO.getByKey(journalClient, dataset);
                if (dataset === undefined) {
                    results.push(-1);
                    continue;
                }
                results.push(!dataset.filemetadata || !dataset.filemetadata.size ? -1 : dataset.filemetadata.size);
            }
        } else {
            for (let dataset of datasets) {
                dataset = (await DatasetDAO.get(journalClient, dataset))[0];
                if (dataset === undefined) {
                    results.push(-1);
                    continue;
                }
                results.push(!dataset.filemetadata || !dataset.filemetadata.size ? -1 : dataset.filemetadata.size);
            }
        }
        Config.enableStrongConsistencyEmulation();

        return results;

    }

    // Compute and retrieve the size and the date of a dataset
    // Required role: subproject.admin
    private static async computeSize(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // parse user request
        // Retrieve the dataset information
        const requestedDateset = DatasetParser.size(req);
        let writeLockSession: IWriteLockSession;

        // retrieve journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // check if the dataset does not exist
        let dataset: DatasetModel;
        let key: any;
        if (subproject.enforce_key) {
            dataset = await DatasetDAO.getByKey(journalClient, requestedDateset);
            key = journalClient.createKey({
                namespace: Config.SEISMIC_STORE_NS + '-' + requestedDateset.tenant + '-' + requestedDateset.subproject,
                path: [Config.DATASETS_KIND],
                enforcedKey: requestedDateset.path.slice(0, -1) + '/' + requestedDateset.name
            });
        } else {
            const results = await DatasetDAO.get(journalClient, requestedDateset);
            dataset = results[0];
            key = results[1];
        }

        if (!dataset) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + requestedDateset.tenant + '/' +
                requestedDateset.subproject + requestedDateset.path + requestedDateset.name + ' does not exist'));
        }

        // Check if legal tag is valid
        if (dataset.ltag) {
            await Auth.isLegalTagValid(req.headers.authorization, dataset.ltag,
                tenant.esd, req[Config.DE_FORWARD_APPKEY]);
        }

        // check if the user is write authorized
        await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.admin),
            tenant, dataset.subproject,
            req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);

        try {

            // attempt to acquire a mutex on the dataset name and set the lock for the dataset in redis
            // a mutex is applied on the resource on the shared cache (removed at the end of the method)
            const datasetLockKey = dataset.tenant + '/' + dataset.subproject + dataset.path + dataset.name;
            writeLockSession = await Locker.createWriteLock(
                datasetLockKey, req.headers['x-seismic-dms-lockid'] as string);

            // Get the container and dataset information
            const bucket = DatasetUtils.getBucketFromDatasetResourceUri(dataset.gcsurl);
            const virtualFolder = DatasetUtils.getVirtualFolderFromDatasetResourceUri(dataset.gcsurl);
            const accessPolicy = subproject.access_policy || Config.UNIFORM_ACCESS_POLICY;

            // Get the size and date
            const size = await StorageFactory.build(
            Config.CLOUDPROVIDER, tenant).getObjectSize(
                bucket, accessPolicy === Config.UNIFORM_ACCESS_POLICY ? virtualFolder : undefined);
            const now = new Date().toString();

            // Update dataset table
            dataset.computed_size = size;
            dataset.computed_size_date = now;
            await DatasetDAO.update(journalClient, dataset, key);

            // release the mutex and unlock the resource
            await Locker.removeWriteLock(writeLockSession);

            return {
                compute_size_byte: size,
                compute_size_date: now
            };

        } catch (err) {

            // release the mutex and unlock the resource
            await Locker.removeWriteLock(writeLockSession);
            throw (err);
        }

    }

    // List the content of a path folder sd://<tenant>/<subproject>/<path>/*
    // Required role: subproject.viewer
    private static async listContent(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset information
        const dataset = DatasetParser.listContent(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // Check authorizations
        await Auth.isReadAuthorized(req.headers.authorization,
            SubprojectAuth.getAuthGroups(subproject, AuthRoles.viewer),
            tenant, dataset.subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        // list the folder content
        return await DatasetDAO.listContent(journalClient, dataset);

    }

    // Add a new tag to the dataset
    // Required role: subproject.admin || dataset.admin (dependents on applied access policy)
    private static async putTags(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        const datasetIN = DatasetParser.putTags(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // ensure is not write locked
        if (!Config.SKIP_WRITE_LOCK_CHECK_ON_MUTABLE_OPERATIONS) {
            const lockKey = datasetIN.tenant + '/' + datasetIN.subproject + datasetIN.path + datasetIN.name;
            if (Locker.isWriteLock(await Locker.getLock(lockKey))) {
                throw (Error.make(Error.Status.LOCKED,
                    'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                    datasetIN.subproject + datasetIN.path + datasetIN.name + ' is write locked ' +
                    Error.get423WriteLockReason()));
            }
        }

        // Retrieve the dataset metadata
        let datasetOUT: DatasetModel;
        let datasetOUTKey: any;
        if (subproject.enforce_key) {
            datasetOUT = await DatasetDAO.getByKey(journalClient, datasetIN);
            datasetOUTKey = journalClient.createKey({
                namespace: Config.SEISMIC_STORE_NS + '-' + datasetIN.tenant + '-' + datasetIN.subproject,
                path: [Config.DATASETS_KIND],
                enforcedKey: datasetIN.path.slice(0, -1) + '/' + datasetIN.name
            });
        } else {
            const results = await DatasetDAO.get(journalClient, datasetIN);
            datasetOUT = results[0];
            datasetOUTKey = results[1];
        }

        // Check if the dataset does not exist
        if (!datasetOUT) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + datasetIN.tenant + '/' +
                datasetIN.subproject + datasetIN.path + datasetIN.name + ' does not exist'));
        }

        if (datasetOUT.gtags) {
            if (typeof datasetOUT.gtags === 'string') {
                const originalGtags = datasetOUT.gtags;
                datasetOUT.gtags = [];
                datasetOUT.gtags.push(originalGtags);
            }
            if (typeof datasetIN.gtags === 'string') {
                datasetOUT.gtags.push(datasetIN.gtags);
            } else {
                datasetOUT.gtags = datasetOUT.gtags.concat(datasetIN.gtags);
            }
            datasetOUT.gtags = datasetOUT.gtags.filter((item, index) => datasetOUT.gtags.indexOf(item) === index);
        } else {
            datasetOUT.gtags = datasetIN.gtags;
        }

        await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, datasetOUT, AuthRoles.admin),
            tenant, datasetIN.subproject,
            req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string);


        await DatasetDAO.update(journalClient, datasetOUT, datasetOUTKey);

    }

    // Check the permissions of a user on a dataset
    // Required role: any
    private static async checkPermissions(req: expRequest, tenant: TenantModel, subproject: SubProjectModel) {

        // Retrieve the dataset path information
        const dataset = DatasetParser.checkPermissions(req);

        // init journalClient client
        const journalClient = JournalFactoryTenantClient.get(tenant);

        // check if the dataset does not exist
        const datasetExist = (subproject.enforce_key ?
            await DatasetDAO.getByKey(journalClient, dataset) :
            (await DatasetDAO.get(journalClient, dataset))[0]) !== undefined;
        if (!datasetExist) {
            throw (Error.make(Error.Status.NOT_FOUND,
                'The dataset ' + Config.SDPATHPREFIX + dataset.tenant + '/' +
                dataset.subproject + dataset.path + dataset.name + ' does not exist'));
        }

        const res = { read: false, write: false, delete: false };

        // Check write authorization
        res.write = await Auth.isWriteAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.admin),
            tenant, dataset.subproject,
            req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string, false);
        // Check read authorization
        res.read = await Auth.isReadAuthorized(req.headers.authorization,
            DatasetAuth.getAuthGroups(subproject, dataset, AuthRoles.viewer),
            tenant, dataset.subproject, req[Config.DE_FORWARD_APPKEY],
            req.headers['impersonation-token-context'] as string, false);

        res.delete = res.write;
        return res;

    }
}
