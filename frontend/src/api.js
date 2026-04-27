import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fetchStats      = () => api.get("/system/stats").then(r => r.data);
export const fetchTenants    = () => api.get("/tenants").then(r => r.data);
export const fetchPrincipals = (tenantId) => api.get("/principals", { params: { tenantId } }).then(r => r.data);
export const fetchStudents   = (tenantId) => api.get("/students", { params: { tenantId } }).then(r => r.data);
export const fetchPolicies   = (layer) => api.get("/policies", { params: { layer } }).then(r => r.data);
export const fetchConsents   = () => api.get("/consents").then(r => r.data);
export const fetchDisclosures= () => api.get("/disclosures").then(r => r.data);
export const fetchIncidents  = (params) => api.get("/incidents", { params }).then(r => r.data);
export const fetchBdia       = (params) => api.get("/bdia", { params }).then(r => r.data);
export const verifyBdia      = (tenantId) => api.get("/bdia/verify", { params: { tenantId } }).then(r => r.data);
export const fetchCes        = () => api.get("/ces-catalog").then(r => r.data);
export const submitAccess    = (body) => api.post("/core/access", body).then(r => r.data);
export const submitAi        = (body) => api.post("/ai/invoke", body).then(r => r.data);

// Teacher Portal
export const fetchTeacherRoster       = (teacherId) => api.get("/teacher/roster", { params: { teacherId } }).then(r => r.data);
export const fetchTeacherAssignments  = (teacherId) => api.get("/teacher/assignments", { params: { teacherId } }).then(r => r.data);
export const fetchTeacherSubmissions  = (teacherId, assignmentId) => api.get("/teacher/submissions", { params: { teacherId, assignmentId } }).then(r => r.data);
export const submitTeacherGrade       = (body) => api.post("/teacher/grade", body).then(r => r.data);
export const approveGradeProposal     = (body) => api.post("/teacher/grade/approve", body).then(r => r.data);
export const fetchGradeProposals      = (teacherId, status) => api.get("/teacher/grade/proposals", { params: { teacherId, status } }).then(r => r.data);
export const generateLesson           = (body) => api.post("/teacher/lesson", body).then(r => r.data);
export const fetchLessons             = (teacherId) => api.get("/teacher/lessons", { params: { teacherId } }).then(r => r.data);
