﻿using Microsoft.Azure.Cosmos;
using Newtonsoft.Json;

namespace Sidecar.Services
{
    public class Cosmos : IDataAccess
    {
        private readonly string databaseId = "sdms-db";
        private readonly string containerId = "data";

        private static Dictionary<string, CosmosClient> cosmosClients = new Dictionary<string, CosmosClient>();

        public async Task Insert(string cs, Record? record)
        {
            if (record == null) { return; };
            this.initCosmosClient(cs);
            Database database = Cosmos.cosmosClients[cs].GetDatabase(this.databaseId);
            Container container = database.GetContainer(this.containerId);
            await container.UpsertItemAsync<Record>(record, new PartitionKey(record.Id));
        }

        public async Task<Record> Get(string cs, string pk)
        {
            this.initCosmosClient(cs);
            Database database = Cosmos.cosmosClients[cs].GetDatabase(this.databaseId);
            Container container = database.GetContainer(this.containerId);
            return await container.ReadItemAsync<Record>(pk, new PartitionKey(pk));
        }

        public async Task Delete(string cs, string pk)
        {
            this.initCosmosClient(cs);
            Database database = Cosmos.cosmosClients[cs].GetDatabase(this.databaseId);
            Container container = database.GetContainer(this.containerId);
            await container.DeleteItemAsync<Record>(pk, new PartitionKey(pk));
        }

        public async Task<string> QueryPath(string cs, string sql, string? ctoken, int? limit)
        {
            this.initCosmosClient(cs);
            Database database = Cosmos.cosmosClients[cs].GetDatabase(this.databaseId);
            Container container = database.GetContainer(this.containerId);
            List<Object> records = new List<Object>();
            Console.WriteLine("sqll {0}", sql);
            Console.WriteLine("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

            QueryRequestOptions options = new QueryRequestOptions() { MaxItemCount = limit != null ? limit : 100 };
            FeedIterator<Object> query = container.GetItemQueryIterator<Object>(
                sql,
                continuationToken: ctoken,
                requestOptions: options);
            if (ctoken == null && limit == null) // fetch all
            {
                while (query.HasMoreResults) 
                {
                    var results = await query.ReadNextAsync();
                    foreach (Object record in results)
                    {
                        Console.WriteLine("pirveli {0} da tipi {1}", record, record.GetType());
                        records.Add(record);
                    }
                }
                
                Console.WriteLine("vabruneb {0}", records);
                PaginatedRecordsPath paginatedRecords = new PaginatedRecordsPath();
                paginatedRecords.records = records;
                paginatedRecords.continuationToken = null;
                paginatedRecords.records.ForEach(i => Console.Write("{0}\t", i));

                return JsonConvert.SerializeObject(paginatedRecords);
            }
            else // fetch next page
            {
                var results = await query.ReadNextAsync();
                foreach (RecordPath record in results)
                {
                    Console.WriteLine("meore {0} da tipi {1}", record, record.GetType());
                    records.Add(record);
                }
                PaginatedRecordsPath paginatedRecords = new PaginatedRecordsPath();
                paginatedRecords.records = records;
                paginatedRecords.continuationToken = results.ContinuationToken;
                return JsonConvert.SerializeObject(paginatedRecords);
            }
        }



        public async Task<string> Query(string cs, string sql, string? ctoken, int? limit)
        {
            this.initCosmosClient(cs);
            Database database = Cosmos.cosmosClients[cs].GetDatabase(this.databaseId);
            Container container = database.GetContainer(this.containerId);
            List<Object> records = new List<Object>();
            QueryRequestOptions options = new QueryRequestOptions() { MaxItemCount = limit != null ? limit : 100 };
            FeedIterator<Object> query = container.GetItemQueryIterator<Object>(
                sql,
                continuationToken: ctoken,
                requestOptions: options);
            if (ctoken == null && limit == null) // fetch all
            {
                while (query.HasMoreResults) 
                {
                    var results = await query.ReadNextAsync();
                    foreach (Object record in results)
                    {
                        Console.WriteLine("AXAli 1 {0} da tipi {1}", record, record.GetType());
                        
                        records.Add(record);
                    }
                }
                PaginatedRecords paginatedRecords = new PaginatedRecords();
                paginatedRecords.records = records;
                paginatedRecords.continuationToken = null;
                return JsonConvert.SerializeObject(paginatedRecords);
            }
            else // fetch next page
            {
                var results = await query.ReadNextAsync();
                foreach (Record record in results)
                {
                    
                        Console.WriteLine("AXAli 2 {0}", record);
                    records.Add(record);
                }
                PaginatedRecords paginatedRecords = new PaginatedRecords();
                paginatedRecords.records = records;
                paginatedRecords.continuationToken = results.ContinuationToken;
                return JsonConvert.SerializeObject(paginatedRecords);
            }
        }

        private void initCosmosClient(string cs)
        {
            if (!Cosmos.cosmosClients.ContainsKey(cs))
            {
                Cosmos.cosmosClients[cs] = new CosmosClient(cs, new CosmosClientOptions()
                {
                    SerializerOptions = new CosmosSerializationOptions()
                    {
                        IgnoreNullValues = true
                    },
                    ConnectionMode = ConnectionMode.Direct,
                });
            }
        }
    }
}
