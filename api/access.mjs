import {endpoint,checkAccess} from '../lib/server.mjs';
export default endpoint('POST',body=>checkAccess(body));
