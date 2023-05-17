// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import { AWSConfig } from './config';
import { AbstractStorage, StorageFactory } from '../../storage';
import { TenantModel } from '../../../services/tenant';
import AWS from 'aws-sdk/global';
import S3 from 'aws-sdk/clients/s3';
import { AWSDataEcosystemServices } from './dataecosystem';
import { AWSSSMhelper } from './ssmhelper';
@StorageFactory.register('aws')
export class AWSStorage extends AbstractStorage {
    private s3: S3; // S3 service object
    private dataPartition: string;
    private awsBucket: string;

    public constructor(tenant: TenantModel) {
        super();
        AWS.config.update({ region: AWSConfig.AWS_REGION });
        this.s3 = new S3({ apiVersion: '2006-03-01' });
        // this.dataPartition = tenant.gcpid;
        this.dataPartition = tenant?.esd.indexOf('.') !== -1 ? tenant?.esd.split('.')[0] : tenant.esd;
        this.awsBucket = '';


    }
    private async getBucket() {
        if (this.awsBucket === '') {
            const tenantId = await AWSDataEcosystemServices.getTenantIdFromPartitionID(this.dataPartition);
            const awsSSMHelper = new AWSSSMhelper();
            const tenantSsmPrefix = '/osdu/tenant-groups/' + AWSConfig.AWS_TENANT_GROUP_NAME + '/tenants/' + tenantId;
            this.awsBucket = await awsSSMHelper.getSSMParameter(
                tenantSsmPrefix + '/seismic-ddms/SeismicDDMSBucket/name');
        }
    }

    private fixFolderFormat(folder: string): string {
        if (folder) {
            folder += '/';
            while (folder.indexOf('//') !== -1) {
                folder = folder.replace('//', '/');
            }
        }
        return folder;
    }

    // generate a random bucket name, for aws, a random folder name
    public async randomBucketName(): Promise<string> {
        await this.getBucket();
        let suffix = Math.random().toString(36).substring(2, 16);
        suffix = suffix + Math.random().toString(36).substring(2, 16);
        suffix = suffix.substr(0, 16);
        return this.awsBucket + '$$' + suffix;
    }

    // whenever ask for a bucket, we return bucketName$$folderName for that subproject
    // this function return the real folderName by remove bucketName$$ at the front of folderName
    public getFolder(folderName: string): string {
        const start = this.awsBucket.length + 2;
        const str = folderName.substr(start);
        return str;
    }

    // Create a new bucket, for aws, create a folder with folderName
    public async createBucket(
        folderName: string,
        location: string, storageClass: string): Promise<void> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Key: folder + '/',
            Body: ''
        };
        try {
            await this.s3.putObject(params).promise();
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.log(err.code + ': ' + err.message);
        }
    }

    // Delete a bucket, for aws, delete folder folderName
    public async deleteBucket(folderName: string, force = false): Promise<void> {
        await this.getBucket();

        if (force) {
            await this.deleteFiles(folderName);
        }
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Key: folder + '/'
        };
        try {
            await this.s3.deleteObject(params).promise();
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.log(err.code + ': ' + err.message);
        }
    }

    // Delete all files in a bucket, for aws, delete all files in the folder
    public async deleteFiles(folderName: string): Promise<void> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Prefix: folder + '/'
        };
        const listedObjects = await this.s3.listObjectsV2(params).promise();
        if (listedObjects.Contents.length === 0)
            return;

        const deleteParams = {
            Bucket: this.awsBucket,
            Delete: { Objects: [] }
        };

        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        await this.s3.deleteObjects(deleteParams).promise();

        if (listedObjects.IsTruncated)  // continue delete files as there are more...
            await this.deleteFiles(folderName);
    }

    // save an object/file to a bucket
    public async saveObject(folderName: string, objectName: string, data: string): Promise<void> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Key: folder + '/' + objectName,
            Body: data
        };
        try {
            await this.s3.putObject(params).promise();
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.log(err.code + ': ' + err.message);
        }
    }

    // delete an object from a bucket
    public async deleteObject(folderName: string, objectName: string): Promise<void> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Key: folder + '/' + objectName
        };
        try {
            await this.s3.deleteObject(params).promise();
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.log(err.code + ': ' + err.message);
        }
    }

    // delete multiple objects
    public async deleteObjects(folderName: string, prefix: string, async: boolean = false): Promise<void> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Prefix: folder + '/' + prefix
        };
        const listedObjects = await this.s3.listObjectsV2(params).promise();

        if (listedObjects.Contents.length === 0) return;

        const deleteParams = {
            Bucket: this.awsBucket,
            Delete: { Objects: [] }
        };

        listedObjects.Contents.forEach(({ Key }) => {
            deleteParams.Delete.Objects.push({ Key });
        });

        await this.s3.deleteObjects(deleteParams).promise();

        if (listedObjects.IsTruncated) // continue delete files as there are more...
            await this.deleteObjects(folderName, prefix);
    }

    // copy multiple objects (skip the dummy file)
    public async copy(folderIn: string, prefixIn: string, folderOut: string, prefixOut: string, ownerEmail: string) {
        await this.getBucket();
        prefixIn = this.fixFolderFormat(prefixIn);
        prefixOut = this.fixFolderFormat(prefixOut);

        const realFolderIn = this.getFolder(folderIn);
        const realFolderOut = this.getFolder(folderOut);

        const copyCalls = [];
        const params = {
            Bucket: this.awsBucket,
            Prefix: realFolderIn + '/' + prefixIn
        };
        const files = await this.s3.listObjects(params).promise();

        for (const file of files['Contents']) {
            let newKey = file.Key.replace(realFolderIn, realFolderOut);
            newKey = newKey.replace(folderIn, prefixOut);
            const param = {
                Bucket: this.awsBucket,
                CopySource: file.Key,
                Key: newKey
            };
            copyCalls.push(this.s3.copyObject(param));
        }
        await Promise.all(copyCalls);
    }

    // check if a bucket exist, for aws, check if folder in the bucket
    // folderName is a string without / at the end
    public async bucketExists(folderName: string): Promise<boolean> {
        await this.getBucket();
        const folder = this.getFolder(folderName);
        const params = {
            Bucket: this.awsBucket,
            Prefix: folder
        };

        const listedObjects = await this.s3.listObjectsV2(params).promise();
        if (listedObjects.Contents.length === 0)
            return false;
        return true;
    }

    public getStorageTiers(): string[] {
        throw new Error('Method not implemented.');
    }

}
