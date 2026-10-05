{{- define "go-guess.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "go-guess.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "go-guess.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "go-guess.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "go-guess.selectorLabels" -}}
app.kubernetes.io/name: {{ include "go-guess.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "go-guess.secretName" -}}
{{- printf "%s-secrets" (include "go-guess.fullname" .) }}
{{- end }}

{{- define "go-guess.postgresqlName" -}}
{{- printf "%s-postgresql" (include "go-guess.fullname" .) }}
{{- end }}

{{- define "go-guess.rabbitmqName" -}}
{{- printf "%s-rabbitmq" (include "go-guess.fullname" .) }}
{{- end }}

{{- define "go-guess.apiDeploymentName" -}}
{{- printf "%s-api" (include "go-guess.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "go-guess.webDeploymentName" -}}
{{- printf "%s-web" (include "go-guess.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* DNS name the API is reachable under. The web image hardcodes "api:8080". */}}
{{- define "go-guess.apiServiceName" -}}
{{- default "api" .Values.api.service.name }}
{{- end }}

{{/* Host serving one tenant, for example nmbs.guess.urpi.be. */}}
{{- define "go-guess.tenantHost" -}}
{{- printf "%s.%s" (index . 0) (index . 1) }}
{{- end }}

{{/* Fallback public URL for invitation and meeting links. */}}
{{- define "go-guess.frontendURL" -}}
{{- if .Values.api.frontendURL }}
{{- .Values.api.frontendURL }}
{{- else if .Values.tenants }}
{{- printf "https://%s.%s" (first .Values.tenants) .Values.domain }}
{{- end }}
{{- end }}

{{/* Secret holding the wildcard-per-tenant web certificate. */}}
{{- define "go-guess.tlsSecretName" -}}
{{- if .Values.ingress.tls.existingSecret }}
{{- .Values.ingress.tls.existingSecret }}
{{- else if .Values.ingress.tls.secretName }}
{{- .Values.ingress.tls.secretName }}
{{- else }}
{{- printf "%s-web-tls" (include "go-guess.fullname" .) }}
{{- end }}
{{- end }}

{{/* Cluster-scoped by default so one issuer signs every tenant release. */}}
{{- define "go-guess.certManagerIssuerRef" -}}
{{- if .Values.certManager.issuerRef }}
{{- toYaml .Values.certManager.issuerRef | nindent 4 }}
{{- else }}
name: selfsigned
kind: Issuer
{{- end }}
{{- end }}

{{- define "go-guess.validate" -}}
{{- if not .Values.tenants }}
{{- fail "tenants must list at least one tenant slug" }}
{{- end }}
{{- if not .Values.domain }}
{{- fail "domain is required" }}
{{- end }}
{{- if and .Values.ingress.enabled .Values.ingress.tls.enabled (not .Values.certManager.enabled) (not .Values.ingress.tls.existingSecret) }}
{{- fail "ingress.tls.enabled requires certManager.enabled or ingress.tls.existingSecret" }}
{{- end }}
{{- end }}

{{/* Secret holding the CA that signs the leaf web certificate. */}}
{{- define "go-guess.certManagerCASecretName" -}}
{{- if .Values.certManager.caSecretName }}
{{- .Values.certManager.caSecretName }}
{{- else }}
{{- printf "%s-web-ca" (include "go-guess.fullname" .) }}
{{- end }}
{{- end }}