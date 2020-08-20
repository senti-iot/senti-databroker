#!/bin/bash
# chmod 700 api-restart.sh

if [[ "$1" == "master" ]]; then
	npm install --prefix /srv/nodejs/senti/services/databroker/production
	systemctl restart senti-databroker.service
	# Senti Slack Workspace
	curl -X POST -H 'Content-type: application/json' --data '{"text":"Senti Data Broker MASTER updated and restarted!"}' $2
	echo
	exit 0
fi

if [[ "$1" == "dev" ]]; then
	npm install --prefix /srv/nodejs/senti/services/databroker/development
	systemctl restart senti-databroker-dev.service
	# Senti Slack Workspace
	curl -X POST -H 'Content-type: application/json' --data '{"text":"Senti Data Broker DEV updated and restarted!"}' $2
	echo
	exit 0
fi

if [[ "$1" == "merge" ]]; then
	npm install --prefix /srv/nodejs/senti/services/databroker/merge
	systemctl restart senti-databroker-merge.service
	# Senti Slack Workspace
	curl -X POST -H 'Content-type: application/json' --data '{"text":"Senti Data Broker MERGE updated and restarted!"}' $2
	echo
	exit 0
fi
exit 0


