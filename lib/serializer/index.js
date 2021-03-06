// dependencies
import _ from 'lodash';
import inflect from 'i';

// serializer utilities
import baseUrl from './utils/base-url';

// general utilities
import parseModelName from '../utils/parse-model-name';
import hasAttribute from '../utils/has-attribute';
import getRelationship from '../utils/get-relationship';
import hasRelationship from '../utils/has-relationship';

export default class Serializer {
  constructor(options = {}) {
    // setup the options
    this.origin = options.origin || 'http://localhost';
    this.port = options.port || 3000;
    this.namespace = options.namespace || '/';

    // setup temp variables used for serializing responses
    this._resource = {};
    this._includes = [];
  }

  /**
   * Loop through the raw Mongo document.
   *
   * ```js
   * {
   *   _id: '55---------------',
   *   name: 'Bob',
   *   age: 22
   * }
   * ```
   *
   * TODO: add how it's transformed
   */
  serializeResource(router, type, document) {
    const fields = router.fields;
    const i = inflect();
    let id = document._id;

    // build resource object
    let resource = this._resource = {
      links: {
        self: baseUrl(router.origin, router.port, router.namespace, type, id),
      },
      id: id,
      type: parseModelName(type),
    };

    // loop through the raw Mongo object
    _.forOwn(document, (value, field) => {
      let isFieldAttribute = hasAttribute(fields, type, field);
      let isFieldRelationship = hasRelationship(fields, type, field);

      // if the field is not an attribute or relationship, stop processing
      if (!(isFieldAttribute || isFieldRelationship)) return;

      // if the field is an attribute, simply add the value to `attributes`
      if (isFieldAttribute) {
        // initialize the resource `attributes` hash
        if (!resource.attributes) {
          resource.attributes = {};
        }

        resource.attributes[field] = value;
        return;
      }

      // the field must be a relationship, more complex processing
      let relationship = value;

      let relationshipDefinition = getRelationship(fields, type, field);
      let relationshipType = relationshipDefinition.type;
      let relationshipIsMany = relationshipDefinition.isMany;

      // initialize `relationships` hash and `included` array
      if (!resource.relationships) {
        resource.relationships = {};
      }

      // add the proper relationship links
      resource.relationships[field] = {
        links: {
          self: `${router.origin}:${router.port}${router.namespace}/${i.pluralize(type)}/${id}/relationships/${field}`,
          related: `${router.origin}:${router.port}${router.namespace}/${i.pluralize(type)}/${id}/${field}`,
        },
      };

      // process the has many relationship
      if (relationshipIsMany) {
        // initialize the data array for this particular relationship
        resource.relationships[field].data = [];

        // loop through all the embedded relationship documents
        _.each(relationship, relatedDocument => {
          const relatedDocumentId = relatedDocument._id;
          // append to the relationship data array with proper type and id
          resource.relationships[field].data.push({
            type: relationshipType,
            id: relatedDocumentId,
          });

          // check if the `included` array doesn't include the related document
          if (!_.find(this._included, { id: relatedDocumentId })) {
            // initialize the relationship attributes and relationships
            let relationshipAttributes = {};
            let relationshipRelationships = {};

            // loop through the related document keys
            _.forOwn(relatedDocument, (relatedDocumentValue, relatedDocumentField) => {
              const isRelatedDocumentFieldRelationship = hasRelationship(fields, relationshipType, relatedDocumentField);
              const isRelatedDocumentFieldAttribute = hasAttribute(fields, relationshipType, relatedDocumentField);

              // if the related document field is not an attribute or relationship, stop processing
              if (!(isRelatedDocumentFieldAttribute || isRelatedDocumentFieldRelationship)) return;

              // the related document field is a relationship
              if (isRelatedDocumentFieldRelationship) {
                // relationshipRelationships[relatedDocumentField] = relatedDocumentValue;
                const relatedDocumentType = getRelationship(fields, relationshipType, relatedDocumentField).type;

                if (_.isArray(relatedDocumentValue)) {
                  relationshipRelationships[relatedDocumentField] = _.map(relatedDocumentValue, relatedDocumentValueId => {
                    return {
                      type: relatedDocumentType,
                      id: relatedDocumentValueId,
                    };
                  });
                } else {
                  relationshipRelationships[relatedDocumentField] = {
                    type: relatedDocumentType,
                    id: relatedDocumentValue,
                  };
                }

                return;
              }

              // the related document field is an attribute
              relationshipAttributes[relatedDocumentField] = relatedDocumentValue;
            });

            // push the document to the `included` array
            console.log('is many!');
            console.log('type:', relationshipType);
            console.log('relatedDocumentId:', relatedDocumentId);

            this._included.push({
              type: relationshipType,
              id: relatedDocumentId,
              links: {
                self: baseUrl(router.origin, router.port, router.namespace, fields[parseModelName(type)].relationships[field].type, relatedDocumentId),
              },
              attributes: relationshipAttributes,
              relationships: relationshipRelationships,
            });
          }
        });
      } else if (relationship) {
        // FIXME: this dirty hack doesn't build proper attributes or relationships
        const relationshipId = relationship._id || relationship;

        // the relationship is a to-one, so add a single hash to `data`
        resource.relationships[field].data = {
          type: relationshipType,
          id: relationshipId,
        };

        // check if the `included` array doesn't include the related document
        if (!_.find(this._included, { id: relationshipId })) {
          // initialize the relationship attributes and relationships
          let relationshipAttributes = {};
          let relationshipRelationships = {};

          // loop through the relationship document keys
          _.forOwn(relationship, (relatedDocumentValue, relatedDocumentField) => {
            const isRelatedDocumentFieldRelationship = hasRelationship(fields, relationshipType, relatedDocumentField);
            const isRelatedDocumentFieldAttribute = hasAttribute(fields, relationshipType, relatedDocumentField);

            // if the related document field is not an attribute or relationship, stop processing
            if (!(isRelatedDocumentFieldAttribute || isRelatedDocumentFieldRelationship)) return;

            // the related document field is a relationship
            if (isRelatedDocumentFieldRelationship) {
              // relationshipRelationships[relatedDocumentField] = relatedDocumentValue;
              const relatedDocumentType = getRelationship(fields, relationshipType, relatedDocumentField).type;

              if (_.isArray(relatedDocumentValue)) {
                relationshipRelationships[relatedDocumentField] = _.map(relatedDocumentValue, relatedDocumentValueId => {
                  return {
                    type: relatedDocumentType,
                    id: relatedDocumentValueId,
                  };
                });
              } else {
                relationshipRelationships[relatedDocumentField] = {
                  type: relatedDocumentType,
                  id: relatedDocumentValue,
                };
              }
              return;
            }

            // the related document field is an attribute
            relationshipAttributes[relatedDocumentField] = relatedDocumentValue;
          });

          // push the document to the `included` array
          this._included.push({
            type: relationshipType,
            id: relationshipId,
            links: {
              self: baseUrl(router.origin, router.port, router.namespace, fields[parseModelName(type)].relationships[field].type, relationshipId),
            },
            attributes: relationshipAttributes,
            relationships: relationshipRelationships,
          });
        }
      }
    });
  }

  serializeResponse(router, method, type, documents, count, pagination) {
    const isMany = _.isArray(documents);
    const modelName = parseModelName(type);

    let endpoint;
    let response = {};
    response.data = isMany ? [] : {};

    this._included = [];

    if (isMany) {
      endpoint = baseUrl(this.origin, this.port, this.namespace, modelName);

      _.each(documents, document => {
        this.serializeResource(router, modelName, document);
        response.data.push(this._resource);
      });

      response.included = this._included;
    } else {
      endpoint = baseUrl(this.origin, this.port, this.namespace, modelName, documents._id);
      this.serializeResource(router, modelName, documents);
      response.data = this._resource;
      response.included = this._included;
    }

    if (method === 'post' || method === 'patch') {
      response.data.links = { self: endpoint };
    } else {
      response.links = { self: endpoint };

      if (count && pagination) {
        let { skip, limit } = pagination;

        // init pagination
        response.links.pagination = {};

        // prev
        if (skip > 0) {
          response.links.pagination.prev = `${endpoint}?page[offset]=${skip - 1}&page[limit]=${limit}`;
        }

        // next
        if (skip + limit < count) {
          response.links.pagination.next = `${endpoint}?page[offset]=${skip + 1}&page[limit]=${limit}`;
        }

        // first and last
        response.links.pagination = {
          first: `${endpoint}?page[offset]=0&page[limit]=${limit}`,
          last: `${endpoint}?page[offset]=${count - limit}&page[limit]=${limit}`,
        };
      }

      // FIXME: super hacky
      delete response.data.links;
    }

    return response;
  }

  /**
   * This method serializes the reponse for a relationship endpoint,
   * i.e. http://www.example.com/api/:type/:id/relationships/:field
   *
   * ```js
   * // example to-one response
   * {
   *   data: {
   *     type: 'person',
   *     id: '12'
   *   }
   * }
   *
   * // example to-many response
   * {
   *   data: [{
   *     type: 'comment',
   *     id: '16'
   *   }, {
   *     type: 'comment',
   *     id: '24'
   *   }]
   * }
   * ```
   *
   * @param {Object} Restle.Router
   * @param {String} type
   * @param {String} name
   * @param {Object} relationship
   * @return {Object}
   */
  serializeRelationship(router, type, name, relationship) {
    let serialized;
    const fields = router.fields[parseModelName(type)];

    if (_.isArray(relationship)) {
      serialized = [];
      _.each(relationship, relation => {
        let relationshipType = fields.relationships[name].type;
        serialized.push({
          type: relationshipType,
          id: relation._id,
        });
      });
    } else {
      if (!_.keys(relationship).length) {
        serialized = null;
      } else {
        let relationshipType = fields.relationships[name].type;
        serialized = {};
        serialized.type = relationshipType;
        serialized.id = relationship._id;
      }
    }

    return serialized;
  }

  /**
   * This method parses a JSON API request and produces a simple JSON that
   * mongoose can digest.
   *
   * ```js
   * // a request that looks like
   * {
   *   data: {
   *     attributes: {
   *       name: 'Bob'
   *     },
   *     relationships: {
   *       pets: {
   *         data: [{
   *           type: 'animal',
   *           id: 1
   *         }, {
   *           type: 'animal',
   *           id: 2
   *         }]
   *       }
   *     }
   *   }
   * }
   *
   * // will serialize into
   * {
   *   name: 'Bob',
   *   pets: [1, 2]
   * }
   * ```
   *
   * TODO: use an error handler
   *
   * @param {Object} body
   * @return {Object}
   */
  serializeRequest(body) {
    if (!body) {
      return {
        errors: [{
          status: 400,
          title: 'Missing request body',
          detail: 'A valid JSON is required in the request body for POST and PATCH commands.',
        }],
      };
    }

    if (!body.data) {
      return {
        errors: [{
          status: 400,
          title: 'Missing data member',
          detail: 'The primary data member is required for POST and PATCH commands.',
        }],
      };
    }

    if (!body.data.type) {
      return {
        errors: [{
          status: 400,
          title: 'Missing primary data type member',
          detail: 'The primary data type member is required for POST and PATCH commands.',
        }],
      };
    }

    const data = body.data;
    const serialized = {};

    // collect attributes
    _.each(_.keys(data.attributes), attribute => {
      serialized[attribute] = data.attributes[attribute];
    });

    // collect relationships
    _.each(_.keys(data.relationships), relationship => {
      const relationshipData = data.relationships[relationship].data;

      if (_.isEmpty(relationshipData)) {
        return;
      }

      if (_.isArray(relationshipData)) {
        serialized[relationship] = [];
        _.each(relationshipData, relation => {
          serialized[relationship].push(relation.id);
        });
      } else {
        serialized[relationship] = relationshipData.id;
      }
    });

    return serialized;
  }

  serializeResourceObject(fields, type, doc, many) {
    if (!doc) {
      throw new Error('Cannot serialize an undefined object!');
    }

    // FIXME: create global inflect so not to call the constructor every time
    const i = inflect();
    const id = doc._id;

    if (!fields) {
      throw new Error('Trying to serialize before fields have been established.');
    }

    if (!id) {
      throw new Error('Cannot serialize document with undefined id.');
    }

    // TODO: create method for building a resource object URL
    const resourceObject = {
      data: {
        type: i.singularize(type),
        id: id,
      },
    };

    if (many) {
      resourceObject.data.links = {};
      resourceObject.data.links.self = `${this.origin}:${this.port}${this.namespace}/${i.pluralize(type)}/${id}`;
    }

    _.forOwn(doc, (value, key) => {
      if (fields.attributes[key]) {
        if (!resourceObject.data.attributes) {
          resourceObject.data.attributes = {};
        }

        resourceObject.data.attributes[key] = value;
      } else if (fields.relationships[key] && value.length) {
        if (!resourceObject.data.relationships) {
          resourceObject.data.relationships = {};
        }

        resourceObject.data.relationships[key] = {
          links: {
            self: `${this.origin}:${this.port}${this.namespace}/${i.pluralize(type)}/${id}/relationships/${key}`,
            related: `${this.origin}:${this.port}${this.namespace}/${i.pluralize(type)}/${id}/${key}`,
          },
        };

        if (_.isArray(value)) {
          resourceObject.data.relationships[key].data = [];

          _.each(value, individualValue => {
            resourceObject.data.relationships[key].data.push({
              type: fields.relationships[key].type,
              id: individualValue,
            });
          });
        } else {
          resourceObject.data.relationships[key].data = {
            id: value,
            type: i.singularize(key),
          };
        }
      }
    });

    return resourceObject;
  }
}
