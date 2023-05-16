/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// Audit log Part A requried fields
// These fields will be auto populated by IFx audit log SDK;
// We need to manually populate them since we are not using their SDK
// References: https://eng.ms/docs/products/geneva/collect/instrument/audit/schema#
// import { CommonProperties } from "@fluidframework/server-services-telemetry";

export interface AuditLogMetadata {
    tenantId: string;
    timeGenerated: Date;
    category: string;
    location: string;
    serviceName: string;
    operationName: string;
    dataPartitionId: string;
    action: string;
    actionId: string;
    puid: string;
    resultType: string;
}

// const g_auditLogEnvelopVersion = "2.1"; // Constant, according to audit log spec
// const g_auditLogPartAEnvName = "#Ifx.AuditSchema"; // Constant, according to audit log spec
// const g_auditLogPartACloudName = "Microsoft.FluidRelay.fluidRelayServers";
// const g_serviceTreeId: string = "T:123ca777-213a-41d8-b79b-4c5d67956cce"; // Format: T:<service tree id>
// const g_heartbeatOperationName: string = "IFxAuditHeartBeatOperationIFx";

// Geneva event settings
// export const auditLogApplicationEventName = "auditlogapplication";
// export const auditLogManagementEventName = "auditlogmanagement";
// export const auditLogHeartbeatEventName = "auditlogheartbeat";
// export const auditLogAadTenantIdColumnName = "AadTenantId";
// export const auditLogContainerColumnName = "FrsContainerId";

// Audit log Part B related
// All Part B related interfaces/enums have ServiceField as prefix
// References: https://eng.ms/docs/products/geneva/collect/instrument/audit/schema#
export enum ServiceFieldResultType {
    Success = "Success",
    Fail = "Fail",
    Timeout = "Timeout",
    ClientError = "ClientError",
}

export enum ServiceFieldAuditCategoryType {
    UserManagement = "UserManagement",
    GroupManagement = "GroupManagement",
    Authorization = "Authorization",
    RoleManagement = "RoleManagement",
    ApplicationManagement = "ApplicationManagement",
    KeyManagement = "KeyManagement",
    DirectoryManagement = "DirectoryManagement",
    ResourceManagement = "ResourceManagement",
    PolicyManagement = "PolicyManagement",
    DeviceManagement = "DeviceManagement",
    EntitlementManagement = "EntitlementManagement",
    PasswordManagement = "PasswordManagement",
    IdentityProtection = "IdentityProtection",
}

// export enum ServiceFieldCallerIdentityType {
//     UPN = "UPN",
//     PUID = "PUID",
//     ObjectId = "ObjectID",
//     Certificate = "Certificate",
//     Claim = "Claim",
//     UserName = "UserName",
//     KeyName = "KeyName",
//     ApplicationId = "ApplicationID",
//     SubscriptionId = "SubscriptionID",
// }

const operationToCategoryMap = new Map<string, ServiceFieldAuditCategoryType[]>([
    ["fluidRelayServers:GetKeys", [ServiceFieldAuditCategoryType.KeyManagement]],
    ["fluidRelayServers:RegenerateKey", [ServiceFieldAuditCategoryType.KeyManagement]],
]);

// export interface ServiceFieldCallerIdentity
// {
//     CallerIdentityType: ServiceFieldCallerIdentityType;
//     CallerIdentityValue: string;
// }

// export enum ServiceFieldTargetResourceType {
//     FluidRelayServer = "FluidRelayServer",
//     FluidRelayContainer = "FluidRelayContainer",
// }

// export interface ServiceFieldTargetResource {
//     TargetResourceType: ServiceFieldTargetResourceType;
//     TargetResourceName: string;
// }

export enum ServiceFieldAuditType {
    Application = "ApplicationAuditLog",
    // This can be enabled if any management privilege actions are added that will require auditing.
    // Management = "ManagementAuditLog",
}

// Audit log Part B fields
// These fields should be populated by services
// export interface AuditLogServiceField {
//     // Required fields
//     OperationName: string;
//     ResultType: ServiceFieldResultType;
//     AuditCategories: ServiceFieldAuditCategoryType[];
//     CallerIdentities: ServiceFieldCallerIdentity[];
//     TargetResources: ServiceFieldTargetResource[];
//     AuditType: ServiceFieldAuditType;

//     // Optional fields
//     ResultDescription?: string;
//     CallerIpAddress?: string;
//     CallerDisplayName?: string;
// }

export function createAuditLogMetadata(tenantId: string): AuditLogMetadata
{
    const metadata: AuditLogMetadata = {
        tenantId: tenantId,
        timeGenerated: new Date(),
        category: "category",
        location: "eastus",
        serviceName: "seismic",
        operationName: "create?",
        dataPartitionId: "dpId",
        action: "idkopname",
        actionId: "IN002",
        puid: "00000-00000-00000-00000",
        resultType: "success",
    };

    return metadata;
}

// export function createAuditLogServiceFields(
//     operationName: string,
//     result: ServiceFieldResultType,
//     auditType: ServiceFieldAuditType,
//     objectId: string,
//     principalId: string,
//     subscriptionId: string,
//     resourceName: string,
//     resultDescription: string,
//     ): AuditLogServiceField {
//     const callerIdentities = [
//         {
//             CallerIdentityType: ServiceFieldCallerIdentityType.ObjectId,
//             CallerIdentityValue: objectId,
//         },
//         {
//             CallerIdentityType: ServiceFieldCallerIdentityType.PUID,
//             CallerIdentityValue: principalId,
//         },
//         {
//             CallerIdentityType: ServiceFieldCallerIdentityType.SubscriptionId,
//             CallerIdentityValue: subscriptionId,
//         },
//     ];

//     const targetResources: ServiceFieldTargetResource[] = [
//         {
//             TargetResourceType: ServiceFieldTargetResourceType.FluidRelayServer,
//             TargetResourceName: resourceName,
//         },
//     ];

//     const auditCategory: ServiceFieldAuditCategoryType[] = operationToCategoryMap.get(operationName)
//         ?? [ServiceFieldAuditCategoryType.ApplicationManagement];

//     const serviceField: AuditLogServiceField = {
//         // Required fields
//         OperationName: operationName,
//         ResultType: result,
//         AuditCategories: auditCategory,
//         CallerIdentities: callerIdentities,
//         TargetResources: targetResources,
//         AuditType: auditType,

//         // Optional fields
//         ResultDescription: resultDescription,
//     };
//     return serviceField;
// }

// export function createAuditLog(
//     operationName: string,
//     resourceType: string,
//     isSuccess: boolean,
//     objectId: string,
//     principalId: string,
//     aadTenantId: string,
//     subscriptionId: string,
//     resourceName: string,
//     resultDescription: string,
//     frsContainerId: string = "null",
//     auditLogType: ServiceFieldAuditType = ServiceFieldAuditType.Application) {
//     const eventName = (auditLogType === ServiceFieldAuditType.Application) ?
//         auditLogApplicationEventName : auditLogManagementEventName;
//     const metadataFields = createAuditLogMetadata(g_serviceTreeId);
//     const auditLogResult: ServiceFieldResultType = isSuccess ?
//         ServiceFieldResultType.Success : ServiceFieldResultType.Fail;

//     const serviceLogFields = createAuditLogServiceFields(
//         `${resourceType}:${operationName}`,
//         auditLogResult,
//         auditLogType,
//         objectId,
//         principalId,
//         subscriptionId,
//         resourceName,
//         resultDescription);

//     const auditLogDataObject = {
//         [CommonProperties.telemetryGroupName]: eventName,
//         [auditLogAadTenantIdColumnName]: aadTenantId,
//         [auditLogContainerColumnName]: frsContainerId,
//         ...serviceLogFields,
//         ...metadataFields,
//     };

//     return auditLogDataObject;
// }

// export function createAuditLogHeartbeat()
// {
//     const metadataFields = createAuditLogMetadata(g_serviceTreeId);

//     const serviceLogFields: AuditLogServiceField = {
//         OperationName: g_heartbeatOperationName,
//         ResultType: ServiceFieldResultType.Success,
//         AuditCategories: [],
//         CallerIdentities: [],
//         TargetResources: [],
//         AuditType: ServiceFieldAuditType.Application,
//         ResultDescription: "FRS audit log heartbeat",
//     };

//     const auditLogHeartbeat = {
//         [CommonProperties.telemetryGroupName]: auditLogHeartbeatEventName,
//         [auditLogAadTenantIdColumnName]: "",
//         [auditLogContainerColumnName]: "",
//         ...serviceLogFields,
//         ...metadataFields,
//     };
//     return auditLogHeartbeat;
// }
