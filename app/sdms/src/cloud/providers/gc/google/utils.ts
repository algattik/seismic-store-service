
/**
 * This module is for functions we are going to use for monkey patching core code to make it more OSDU compatible
 * This may look ugly, however it seems to be the only option to make Seismic be more OSDU-wise  
 */


/**
 * This function is used for overriding Auth.isImpersonationToken, 
 * because the method can't work with Google Auth tokens
 * @param authToken some token
 */
const isImpersonationToken = function(authToken: string){
    false;
}
