{{/*
Expand the name of the chart.
*/}}
{{- define "acmehub-syncer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "acmehub-syncer.fullname" -}}
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

{{/*
Namespace for the operator and ClusterACMEHubConsumer token Secrets.
Defaults to the release namespace (the Helm `--namespace` / HelmChart
`targetNamespace`), so no separate value is needed for the common case.
The namespace must already exist; the chart does not create it.
*/}}
{{- define "acmehub-syncer.namespace" -}}
{{- default .Release.Namespace .Values.clusterResourceNamespace -}}
{{- end }}

{{/*
Common labels
*/}}
{{- define "acmehub-syncer.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{ include "acmehub-syncer.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "acmehub-syncer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "acmehub-syncer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
