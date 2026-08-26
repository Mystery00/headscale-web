export const enUS = {
  app: {
    title: 'Headscale Web',
  },
  connection: {
    title: 'Connect to Headscale',
    urlLabel: 'Headscale URL',
    apiKeyLabel: 'API Key',
    showApiKey: 'Show API key',
    hideApiKey: 'Hide API key',
    persistenceSession: 'This session',
    persistenceLocal: 'Remember on this device',
    localRisk:
      'The API key will be stored in localStorage and can be read by other scripts on this origin.',
    localRiskConfirm: 'I understand the risk of long-term storage',
    connect: 'Connect',
    connecting: 'Connecting',
    steps: {
      network: 'Network',
      version: 'Version',
      database: 'Database',
      authorization: 'Authorization',
    },
    errors: {
      empty: 'Enter a Headscale URL.',
      invalid: 'Enter a valid URL.',
      unsupportedProtocol: 'Use http or https.',
      credentialsNotAllowed: 'Do not include credentials in the URL.',
      network: 'Could not reach Headscale.',
      timeout: 'The request timed out.',
      cors: 'The browser blocked the request. Check CORS on the Headscale origin.',
      unsupportedVersion: 'This UI only supports Headscale 0.29.x.',
      unauthorized: 'The API key was rejected.',
      unknown: 'Something went wrong while connecting.',
    },
  },
  shell: {
    disconnect: 'Disconnect',
    version: 'Version',
    databaseConnected: 'Database connected',
    databaseDisconnected: 'Database disconnected',
  },
}
