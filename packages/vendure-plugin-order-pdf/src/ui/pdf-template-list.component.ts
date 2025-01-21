import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import {
  ConfigArgDefinition,
  getServerLocation,
  LocalStorageService,
  NotificationService,
  SharedModule,
  TypedBaseListComponent,
} from '@vendure/admin-ui/core';
import { TypedDocumentNode } from '@apollo/client';
import {
  createPDFTemplate,
  deletePDFTemplate,
  getPDFTemplates,
  updatePDFTemplate,
} from './queries.graphql';
import {
  CreatePdfTemplateMutation,
  CreatePdfTemplateMutationVariables,
  DeletePdfTemplateMutation,
  DeletePdfTemplateMutationVariables,
  PdfTemplate,
  PdfTemplateList,
  Scalars,
  UpdatePdfTemplateMutation,
  UpdatePdfTemplateMutationVariables,
} from './generated/graphql';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';

const GetPDFTemplatesDocument: TypedDocumentNode<{
  pdfTemplates: PdfTemplateList;
}> = getPDFTemplates;

@Component({
  selector: 'pl-pdf-template-list-component',
  templateUrl: './pdf-template-list.component.html',
  standalone: true,
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .modal-footer.pdf-template {
        display: block;
      }
    `,
  ],
})
export class PDFTemplateListComponent extends TypedBaseListComponent<
  typeof GetPDFTemplatesDocument,
  'pdfTemplates'
> {
  currencyCode: any;
  showModal = false;
  modalAction: 'Edit' | 'Create' = 'Create';
  currentPdfTemplate = {
    id: '' as Scalars['ID'],
    enabled: true,
    name: '',
    templateString: '',
  };
  previewLoading = false;
  serverPath: string;
  htmlFormInputConfigArgsDef: ConfigArgDefinition = {
    name: 'templateString',
    type: 'text',
    list: false,
    required: false,
    ui: { component: 'html-editor-form-input' },
  };
  form: FormGroup;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private notificationService: NotificationService,
    private localStorageService: LocalStorageService
  ) {
    super();
    super.configure({
      document: GetPDFTemplatesDocument,
      getItems: (data) => data.pdfTemplates,
      refreshListOnChanges: [],
    });
    this.serverPath = getServerLocation();
    this.form = this.formBuilder.group({
      templateString: '',
    });
  }

  create() {
    this.modalAction = 'Create';
    this.clear();
    this.showModal = true;
  }

  edit(template: PdfTemplate) {
    this.modalAction = 'Edit';
    this.currentPdfTemplate.id = template.id;
    this.currentPdfTemplate.name = template.name;

    this.showModal = true;
  }

  delete() {
    this.dataService
      .mutate<DeletePdfTemplateMutation, DeletePdfTemplateMutationVariables>(
        deletePDFTemplate,
        {
          id: this.currentPdfTemplate.id,
        }
      )
      .subscribe((s: any) => {
        this.showModal = false;
        this.clear();
        this.notificationService.success('Deleted');
        this.changeDetector.detectChanges();
        super.refresh();
      });
  }

  clear() {
    this.currentPdfTemplate.id = '';
    this.currentPdfTemplate.name = '';
    this.currentPdfTemplate.enabled = true;
    this.currentPdfTemplate.templateString = '';
  }

  createOrUpdate() {
    console.log(this.currentPdfTemplate);
    if (this.currentPdfTemplate.id) {
      // Update
      this.dataService
        .mutate<UpdatePdfTemplateMutation, UpdatePdfTemplateMutationVariables>(
          updatePDFTemplate,
          {
            id: this.currentPdfTemplate.id,
            input: {
              enabled: this.currentPdfTemplate.enabled,
              name: this.currentPdfTemplate.name,
              templateString: this.currentPdfTemplate.templateString,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clear();
          this.notificationService.success('Saved');
          this.changeDetector.detectChanges();
        });
    } else {
      // Create new
      this.dataService
        .mutate<CreatePdfTemplateMutation, CreatePdfTemplateMutationVariables>(
          createPDFTemplate,
          {
            input: {
              name: this.currentPdfTemplate.name,
              enabled: this.currentPdfTemplate.enabled,
              templateString: this.currentPdfTemplate.templateString,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clear();
          this.notificationService.success('Created');
          this.changeDetector.detectChanges();
          super.refresh();
        });
    }
  }

  async preview() {
    try {
      this.previewLoading = true;
      const res = await fetch(
        `${this.serverPath}/pdf-templates/preview/${this.currentPdfTemplate.name}`,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            template: this.currentPdfTemplate.templateString,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const blob = await res.blob();
      await this.downloadBlob(blob, 'test.pdf', true);
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err?.message);
    }
    this.previewLoading = false;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const channelToken = this.localStorageService.get('activeChannelToken');
    if (channelToken) {
      headers['vendure-token'] = channelToken;
    }
    const authToken = this.localStorageService.get('authToken');
    if (authToken) {
      headers.authorization = `Bearer ${authToken}`;
    }
    return headers;
  }

  private async downloadBlob(
    blob: Blob,
    fileName: string,
    openInNewTab = false
  ): Promise<void> {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.setAttribute('hidden', 'true');
    a.href = blobUrl;
    if (!openInNewTab) {
      a.download = fileName;
    }
    a.setAttribute('target', '_blank');
    a.click();
  }
}
