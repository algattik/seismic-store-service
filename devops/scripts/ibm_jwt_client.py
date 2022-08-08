import os
import requests
import json

url = os.getenv('KEYCLOAK_URL')


payload = ""
headers = {
            'Content-Type': "application/x-www-form-urlencoded"
                }
full_url="https://"+url+"/auth/realms/OSDU/protocol/openid-connect/token"
response = requests.request("POST", full_url, data=payload, headers=headers)

result = response.json()
token = result['access_token']
print(token)
