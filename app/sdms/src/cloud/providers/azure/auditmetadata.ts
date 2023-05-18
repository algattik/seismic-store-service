/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// Audit log Part A requried fields
// These fields will be auto populated by IFx audit log SDK;
// We need to manually populate them since we are not using their SDK
// References: https://eng.ms/docs/products/geneva/collect/instrument/audit/schema#
// import { CommonProperties } from "@fluidframework/server-services-telemetry";
import { Request as expRequest, Response as expResponse } from 'express';

export interface AuditLogMetadata {
    tenantId: string;
    subscriptionId: string;
    timeGenerated: Date;
    category: string;
    location: string;
    serviceName: string;
    operationName: string;
    dataPartitionId: string;
    action: string;
    actionId: string;
    puId: string;
    resultType: string;
    resourceId: string;
}

// Audit log enums
export enum ServiceFieldResultType {
    Success = "Success",
    Fail = "Fail",
    Timeout = "Timeout",
    ClientError = "ClientError",
}

export enum ServiceFieldOperationType {
    Create = "Create",
    Update = "Update",
    Delete = "Delete",
    Read = "Read",
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
}

export function createAuditLogMetadata(req: expRequest, responseCode: string, opName: string): AuditLogMetadata
{
    const metadata: AuditLogMetadata = {
        tenantId: req.header("x-ms-client-tenant-id"),
        subscriptionId: req.params.subscriptionId,
        timeGenerated: new Date(),
        category: ServiceFieldAuditCategoryType.ResourceManagement,
        location: "eastus",  // TODO: dummy var, make actual region
        serviceName: "Seismic.Audit",
        operationName: opName,
        dataPartitionId: req.params.tenantid,
        action: ServiceFieldOperationType.Create,  // TODO: dummy var, use request to define action
        actionId: "IN002",
        puId: req.header("x-ms-client-object-id"),
        resultType: responseCode,  // TODO: change this from code to enum
        resourceId: req.header("x-ms-client-principal-id"),
    };



    return metadata;
}
